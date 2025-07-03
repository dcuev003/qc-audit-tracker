export async function injectScript(filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(`assets/${filename}`);
    
    script.onload = () => {
      script.remove();
      resolve();
    };
    
    script.onerror = () => {
      reject(new Error(`Failed to load ${filename}`));
    };
    
    (document.head || document.documentElement).appendChild(script);
  });
}

export function injectConfig(config: any): void {
  const configScript = document.createElement('script');
  configScript.id = 'qc-tracker-config';
  configScript.type = 'application/json';
  configScript.textContent = JSON.stringify(config);
  (document.head || document.documentElement).appendChild(configScript);
}