// Utility function to safely parse JSON responses
// Prevents "body stream already read" errors

export async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    
    // Parse JSON once and store it
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      // If JSON parsing fails, throw a clear error
      console.error('Failed to parse JSON response:', parseError);
      throw new Error('Invalid response from server');
    }
    
    // Return both response metadata and parsed data
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: data
    };
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}

// Usage example:
// const { ok, data } = await safeFetch('/api/auth/login', {...});
// if (!ok) throw new Error(data.detail || 'Request failed');
