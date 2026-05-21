/**
 * API Documentation Page
 *
 * Interactive API documentation using Swagger UI
 */
import React, { useEffect, useState } from 'react';

import SwaggerUI from 'swagger-ui-react';
// Swagger CSS (moved from _app.tsx for better performance)
import 'swagger-ui-react/swagger-ui.css';

import { logger } from '../utils/logger';
export default function ApiDocs(): React.ReactElement {
    const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
    useEffect(() => {
        // Fetch OpenAPI spec
        fetch('/api/v1/openapi.json').
            then((res) => res.json()).
            then((data: unknown) => setSpec(data as Record<string, unknown>)).
            catch((err) => logger.error('Failed to load OpenAPI spec:', err));
    }, []);
    if (!spec) {
        return (<div style={{ padding: '20px', fontFamily: 'system-ui' }}>
        <h1>API Documentation</h1>
        <p>Loading...</p>
      </div>);
    }
    return (<div style={{ height: '100vh' }}>
      <SwaggerUI spec={spec} docExpansion="list" defaultModelsExpandDepth={1} defaultModelExpandDepth={1} tryItOutEnabled={true} persistAuthorization={true}/>

    </div>);
}
