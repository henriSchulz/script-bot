import { useState, useEffect } from 'react';

export function useAiKey() {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check for cookie
    const checkKey = () => {
      if (typeof document === 'undefined') return;
      
      const value = `; ${document.cookie}`;
      const parts = value.split(`; gemini-api-key=`);
      
      if (parts.length === 2) {
        const key = parts.pop()?.split(';').shift();
        setHasKey(!!key && key.trim().length > 0);
      } else {
        setHasKey(false);
      }
      setLoading(false);
    };

    checkKey();
    
    // Listen for storage events (if key is set in another tab)
    // Or just interval check for simplicity in same tab if we don't use context
    const interval = setInterval(checkKey, 2000); 
    
    return () => clearInterval(interval);
  }, []);

  return { hasKey, loading };
}
