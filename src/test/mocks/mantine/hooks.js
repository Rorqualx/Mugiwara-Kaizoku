/**
 * Enhanced Mantine Hooks Mock for Testing
 * 
 * Provides mocking for @mantine/hooks package with proper hook behavior.
 */

const React = require('react');

// Enhanced useDisclosure hook
const useDisclosure = (initial = false, callbacks = {}) => {
  const [opened, setOpened] = React.useState(initial);
  
  const open = React.useCallback(() => {
    setOpened(true);
    callbacks.onOpen && callbacks.onOpen();
  }, [callbacks]);
  
  const close = React.useCallback(() => {
    setOpened(false);
    callbacks.onClose && callbacks.onClose();
  }, [callbacks]);
  
  const toggle = React.useCallback(() => {
    const newValue = !opened;
    setOpened(newValue);
    if (newValue) {
      callbacks.onOpen && callbacks.onOpen();
    } else {
      callbacks.onClose && callbacks.onClose();
    }
  }, [opened, callbacks]);
  
  return [opened, { open, close, toggle }];
};

// Enhanced useHover hook
const useHover = () => {
  const [hovered, setHovered] = React.useState(false);
  
  const ref = React.useRef(null);
  
  React.useEffect(() => {
    const node = ref.current;
    if (node) {
      const handleMouseEnter = () => setHovered(true);
      const handleMouseLeave = () => setHovered(false);
      
      node.addEventListener('mouseenter', handleMouseEnter);
      node.addEventListener('mouseleave', handleMouseLeave);
      
      return () => {
        node.removeEventListener('mouseenter', handleMouseEnter);
        node.removeEventListener('mouseleave', handleMouseLeave);
      };
    }
  }, []);
  
  return { hovered, ref };
};

// Enhanced useClickOutside hook
const useClickOutside = (handler, events = ['mousedown', 'touchstart']) => {
  const ref = React.useRef();
  
  React.useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    
    events.forEach((event) => {
      document.addEventListener(event, listener);
    });
    
    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, listener);
      });
    };
  }, [handler, events]);
  
  return ref;
};

// Enhanced useViewportSize hook
const useViewportSize = () => {
  const [size, setSize] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768
  });
  
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return size;
};

// Enhanced useLocalStorage hook
const useLocalStorage = ({ key, defaultValue, serialize = JSON.stringify, deserialize = JSON.parse }) => {
  const [value, setValue] = React.useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  
  const setStoredValue = React.useCallback((newValue) => {
    try {
      setValue(newValue);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, serialize(newValue));
      }
    } catch {
      // Silently fail
    }
  }, [key, serialize]);
  
  const removeStoredValue = React.useCallback(() => {
    try {
      setValue(defaultValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Silently fail
    }
  }, [key, defaultValue]);
  
  return [value, setStoredValue, removeStoredValue];
};

// Enhanced useToggle hook
const useToggle = (options = [false, true]) => {
  const [value, setValue] = React.useState(options[0]);
  
  const toggle = React.useCallback((val) => {
    if (typeof val !== 'undefined') {
      setValue(val);
      return;
    }
    
    setValue((current) => {
      const index = options.indexOf(current);
      const nextIndex = index === -1 ? 1 : (index + 1) % options.length;
      return options[nextIndex];
    });
  }, [options]);
  
  return [value, toggle];
};

// Enhanced useCounter hook
const useCounter = (initialValue = 0, { min, max } = {}) => {
  const [count, setCount] = React.useState(initialValue);
  
  const increment = React.useCallback((delta = 1) => {
    setCount((current) => {
      const next = current + delta;
      if (max !== undefined) return Math.min(next, max);
      return next;
    });
  }, [max]);
  
  const decrement = React.useCallback((delta = 1) => {
    setCount((current) => {
      const next = current - delta;
      if (min !== undefined) return Math.max(next, min);
      return next;
    });
  }, [min]);
  
  const set = React.useCallback((value) => {
    setCount((current) => {
      let next = typeof value === 'function' ? value(current) : value;
      if (max !== undefined) next = Math.min(next, max);
      if (min !== undefined) next = Math.max(next, min);
      return next;
    });
  }, [min, max]);
  
  const reset = React.useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);
  
  return { count, increment, decrement, set, reset };
};

module.exports = {
  useDisclosure,
  useHover,
  useClickOutside,
  useViewportSize,
  useLocalStorage,
  useToggle,
  useCounter
};