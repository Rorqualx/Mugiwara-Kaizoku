-- ============================================================================
-- WebSocket Distributed Infrastructure Migration
-- Created: 2025-11-08
-- Purpose: Enable distributed WebSocket with PostgreSQL backend (no Redis)
-- ============================================================================

-- ============================================================================
-- 1. WebSocket Connections Table
-- Track active WebSocket connections across all server instances
-- ============================================================================
CREATE UNLOGGED TABLE IF NOT EXISTS websocket_connections (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id TEXT NOT NULL,
  session_id UUID REFERENCES sessions_cache(session_id) ON DELETE CASCADE,
  user_id TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  client_metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT fk_session FOREIGN KEY (session_id) REFERENCES sessions_cache(session_id) ON DELETE CASCADE
) WITH (fillfactor = 85);

COMMENT ON TABLE websocket_connections IS 'Tracks active WebSocket connections across all server instances';
COMMENT ON COLUMN websocket_connections.server_id IS 'ID of the server handling this connection';
COMMENT ON COLUMN websocket_connections.session_id IS 'Reference to the user session';
COMMENT ON COLUMN websocket_connections.client_metadata IS 'Additional client information (user agent, IP, etc.)';

-- Partial index predicates can't use NOW() (must be IMMUTABLE on PG15+);
-- the (server_id, last_activity) composite gives the same lookup shape
-- with a slightly larger but still selective index.
CREATE INDEX idx_ws_conn_server ON websocket_connections(server_id, last_activity DESC);
CREATE INDEX idx_ws_conn_user ON websocket_connections(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_ws_conn_activity ON websocket_connections(last_activity);
CREATE INDEX idx_ws_conn_session ON websocket_connections(session_id);

-- ============================================================================
-- 2. Channel Subscriptions Table
-- Track which connections are subscribed to which channels
-- ============================================================================
CREATE UNLOGGED TABLE IF NOT EXISTS channel_subscriptions (
  connection_id UUID NOT NULL REFERENCES websocket_connections(connection_id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filters JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (connection_id, channel)
) WITH (fillfactor = 85);

COMMENT ON TABLE channel_subscriptions IS 'Tracks channel subscriptions for each connection';
COMMENT ON COLUMN channel_subscriptions.filters IS 'Optional filters for selective message delivery';

CREATE INDEX idx_chan_sub_channel ON channel_subscriptions(channel);
CREATE INDEX idx_chan_sub_conn ON channel_subscriptions(connection_id);

-- ============================================================================
-- 3. Rate Limiting Table
-- Sliding window rate limiting for connections and channels
-- ============================================================================
CREATE UNLOGGED TABLE IF NOT EXISTS rate_limits (
  limit_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 minute'
) WITH (fillfactor = 70);

COMMENT ON TABLE rate_limits IS 'Sliding window rate limiting for WebSocket operations';
COMMENT ON COLUMN rate_limits.limit_key IS 'Format: connection_id:operation or user_id:channel';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the current rate limit window';

-- Partial predicate `WHERE expires_at > NOW()` is invalid on PG15+ (NOW
-- is volatile). Plain index over the column is fine — sweepers query
-- `WHERE expires_at < NOW()` and the index is still range-scannable.
CREATE INDEX idx_rate_limit_expires ON rate_limits(expires_at);

-- ============================================================================
-- 4. Presence Tracking Table
-- Track user presence across channels
-- ============================================================================
CREATE UNLOGGED TABLE IF NOT EXISTS presence_tracking (
  channel TEXT NOT NULL,
  user_id TEXT NOT NULL,
  connection_id UUID REFERENCES websocket_connections(connection_id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('online', 'away', 'offline')),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (channel, user_id)
) WITH (fillfactor = 85);

COMMENT ON TABLE presence_tracking IS 'Tracks user presence per channel across all servers';
COMMENT ON COLUMN presence_tracking.status IS 'User presence status: online, away, or offline';
COMMENT ON COLUMN presence_tracking.metadata IS 'Custom presence data (status message, etc.)';

CREATE INDEX idx_presence_channel ON presence_tracking(channel) WHERE status != 'offline';
CREATE INDEX idx_presence_user ON presence_tracking(user_id);
CREATE INDEX idx_presence_last_seen ON presence_tracking(last_seen);

-- ============================================================================
-- 5. WebSocket Servers Registry
-- Track active WebSocket server instances for coordination
-- ============================================================================
CREATE UNLOGGED TABLE IF NOT EXISTS websocket_servers (
  server_id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL,
  port INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connection_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draining', 'stopped')),
  metadata JSONB DEFAULT '{}'::jsonb
) WITH (fillfactor = 85);

COMMENT ON TABLE websocket_servers IS 'Registry of active WebSocket server instances';
COMMENT ON COLUMN websocket_servers.status IS 'Server status: active (accepting connections), draining (graceful shutdown), stopped';
COMMENT ON COLUMN websocket_servers.metadata IS 'Server metadata (version, region, etc.)';

CREATE INDEX idx_ws_server_heartbeat ON websocket_servers(last_heartbeat) WHERE status = 'active';
CREATE INDEX idx_ws_server_status ON websocket_servers(status);

-- ============================================================================
-- 6. Message Routing Table
-- Queue for cross-server message delivery
-- ============================================================================
CREATE UNLOGGED TABLE IF NOT EXISTS message_routing (
  id BIGSERIAL PRIMARY KEY,
  target_server TEXT NOT NULL,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered BOOLEAN DEFAULT FALSE,
  delivery_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '5 minutes'
) WITH (fillfactor = 70);

COMMENT ON TABLE message_routing IS 'Message queue for cross-server WebSocket delivery';
COMMENT ON COLUMN message_routing.delivery_attempts IS 'Number of delivery attempts (max 3)';

CREATE INDEX idx_msg_routing_pending ON message_routing(target_server, delivered) WHERE NOT delivered AND delivery_attempts < 3;
CREATE INDEX idx_msg_routing_channel ON message_routing(channel);
CREATE INDEX idx_msg_routing_expires ON message_routing(expires_at) WHERE NOT delivered;

-- ============================================================================
-- PostgreSQL Functions
-- ============================================================================

-- Function: Clean up stale connections (not active in last 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_connections()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM websocket_connections
  WHERE last_activity < NOW() - INTERVAL '5 minutes';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_stale_connections() IS 'Removes connections inactive for more than 5 minutes';

-- Function: Check rate limit (sliding window algorithm)
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMP WITH TIME ZONE;
BEGIN
  v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  -- Atomic upsert with count increment
  INSERT INTO rate_limits (limit_key, count, window_start, expires_at)
  VALUES (
    p_key,
    1,
    NOW(),
    NOW() + (p_window_seconds || ' seconds')::INTERVAL
  )
  ON CONFLICT (limit_key) DO UPDATE SET
    count = CASE
      WHEN rate_limits.window_start < v_window_start THEN 1
      ELSE rate_limits.count + 1
    END,
    window_start = CASE
      WHEN rate_limits.window_start < v_window_start THEN NOW()
      ELSE rate_limits.window_start
    END,
    expires_at = NOW() + (p_window_seconds || ' seconds')::INTERVAL
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) IS 'Checks if operation is within rate limit using sliding window';

-- Function: Route message to correct server(s)
CREATE OR REPLACE FUNCTION route_message(
  p_channel TEXT,
  p_payload JSONB
)
RETURNS TABLE(server_id TEXT, connection_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wc.server_id,
    COUNT(*) as connection_count
  FROM websocket_connections wc
  INNER JOIN channel_subscriptions cs ON cs.connection_id = wc.connection_id
  WHERE cs.channel = p_channel
    AND wc.last_activity > NOW() - INTERVAL '5 minutes'
  GROUP BY wc.server_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION route_message(TEXT, JSONB) IS 'Returns which servers need to receive a message for a given channel';

-- Function: Get active servers
CREATE OR REPLACE FUNCTION get_active_servers()
RETURNS TABLE(
  server_id TEXT,
  hostname TEXT,
  connection_count INTEGER,
  uptime_seconds BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ws.server_id,
    ws.hostname,
    ws.connection_count,
    EXTRACT(EPOCH FROM (NOW() - ws.started_at))::BIGINT as uptime_seconds
  FROM websocket_servers ws
  WHERE ws.status = 'active'
    AND ws.last_heartbeat > NOW() - INTERVAL '1 minute'
  ORDER BY ws.connection_count ASC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_active_servers() IS 'Returns list of active servers for load balancing';

-- Function: Update presence
CREATE OR REPLACE FUNCTION update_presence(
  p_channel TEXT,
  p_user_id TEXT,
  p_connection_id UUID,
  p_status TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO presence_tracking (channel, user_id, connection_id, status, last_seen, metadata)
  VALUES (p_channel, p_user_id, p_connection_id, p_status, NOW(), p_metadata)
  ON CONFLICT (channel, user_id) DO UPDATE SET
    connection_id = p_connection_id,
    status = p_status,
    last_seen = NOW(),
    metadata = p_metadata;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_presence(TEXT, TEXT, UUID, TEXT, JSONB) IS 'Updates user presence in a channel';

-- Function: Clean expired rate limits
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_rate_limits() IS 'Removes expired rate limit entries';

-- Function: Clean expired messages
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM message_routing
  WHERE expires_at < NOW() OR (delivered AND published_at < NOW() - INTERVAL '1 hour');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_messages() IS 'Removes expired or delivered messages from routing queue';

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Update server connection count
CREATE OR REPLACE FUNCTION update_server_connection_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE websocket_servers
    SET connection_count = connection_count + 1
    WHERE server_id = NEW.server_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE websocket_servers
    SET connection_count = GREATEST(0, connection_count - 1)
    WHERE server_id = OLD.server_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_connection_count
AFTER INSERT OR DELETE ON websocket_connections
FOR EACH ROW
EXECUTE FUNCTION update_server_connection_count();

COMMENT ON TRIGGER trg_update_connection_count ON websocket_connections IS 'Automatically updates connection count when connections are added/removed';

-- Trigger: Notify on new message for routing
CREATE OR REPLACE FUNCTION notify_message_routing()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'message_routing_' || NEW.target_server,
    json_build_object(
      'id', NEW.id,
      'channel', NEW.channel
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_message_routing
AFTER INSERT ON message_routing
FOR EACH ROW
EXECUTE FUNCTION notify_message_routing();

COMMENT ON TRIGGER trg_notify_message_routing ON message_routing IS 'Notifies target server of new routed message via LISTEN/NOTIFY';

-- ============================================================================
-- Grants (adjust based on your database user)
-- ============================================================================

-- Grant permissions (adjust role_name as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;

-- ============================================================================
-- Cleanup Scheduled Tasks (Optional - requires pg_cron extension)
-- ============================================================================

-- Schedule cleanup tasks every minute (requires pg_cron)
-- SELECT cron.schedule('cleanup-stale-ws-connections', '* * * * *', 'SELECT cleanup_stale_connections()');
-- SELECT cron.schedule('cleanup-expired-rate-limits', '* * * * *', 'SELECT cleanup_expired_rate_limits()');
-- SELECT cron.schedule('cleanup-expired-messages', '* * * * *', 'SELECT cleanup_expired_messages()');

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verify migration
DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'websocket_connections',
      'channel_subscriptions',
      'rate_limits',
      'presence_tracking',
      'websocket_servers',
      'message_routing'
    );

  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN (
      'cleanup_stale_connections',
      'check_rate_limit',
      'route_message',
      'get_active_servers',
      'update_presence',
      'cleanup_expired_rate_limits',
      'cleanup_expired_messages'
    );

  RAISE NOTICE 'Migration verification: % tables, % functions created', table_count, function_count;

  IF table_count < 6 THEN
    RAISE EXCEPTION 'Migration incomplete: Expected 6 tables, found %', table_count;
  END IF;

  IF function_count < 7 THEN
    RAISE EXCEPTION 'Migration incomplete: Expected 7 functions, found %', function_count;
  END IF;
END $$;
