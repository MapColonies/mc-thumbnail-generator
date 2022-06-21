(async () => {
    fetch('./cesiumClientWebConfig.json')
    .then(res => res.json())
    .then((config) => {
        globalThis.CONFIG = config;
        
        const headerEl = document.getElementsByTagName("head")[0];   
        const scriptEl = document.createElement('script');
            scriptEl.type = 'text/javascript';
            scriptEl.src = './script.js';
            headerEl.appendChild(scriptEl);
    })
})()