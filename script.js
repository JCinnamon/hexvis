let pyodide;

async function initializePyodide() {
    try {
        document.getElementById('loading').textContent = 'Loading Pyodide...';
        document.getElementById('loading').classList.remove('hidden');
        
        pyodide = await loadPyodide();
        
        document.getElementById('loading').textContent = 'Loading packages...';
        await pyodide.loadPackage(["numpy", "scikit-learn", "pandas"]);
        
        // Add a small delay before finalizing
        await new Promise(resolve => setTimeout(resolve, 1000));

        document.querySelector('button').disabled = false;
        document.getElementById('loading').textContent = 'Ready!';
        setTimeout(() => {
            document.getElementById('loading').classList.add('hidden');
        }, 2000);
    } catch (error) {
        console.error('Failed to initialize Pyodide:', error);
        document.getElementById('loading').textContent = 'Failed to load. Please refresh the page and try again.';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('button').disabled = true;
    initializePyodide();
});

function showError(message) {
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function isValidHexCode(hexCode) {
    return /^#[0-9A-Fa-f]{6}$/.test(hexCode);
}

async function processColors() {
    hideError();
    const hexInput = document.getElementById('hexInput').value;
    const hexcodes = hexInput.split('\n').map(code => code.trim()).filter(code => code !== '');
    
    if (hexcodes.length === 0) {
        showError('Please enter at least one hexcode.');
        return;
    }

    const invalidHexcodes = hexcodes.filter(code => !isValidHexCode(code));
    if (invalidHexcodes.length > 0) {
        showError(`Invalid hexcodes: ${invalidHexcodes.join(', ')}`);
        return;
    }

    const numClusters = parseInt(document.getElementById('numClusters').value);
    if (isNaN(numClusters) || numClusters < 1 || numClusters > 20) {
        showError('Number of clusters must be between 1 and 20.');
        return;
    }

    document.getElementById('loading').textContent = 'Processing colors...';
    document.getElementById('loading').classList.remove('hidden');

    try {
        const result = await pyodide.runPythonAsync(`
            import numpy as np
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
            import json

            def process_colors(hexcodes, n_clusters):
                def hex_to_rgb(hex_color):
                    hex_color = hex_color.lstrip('#')
                    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

                def rgb_to_hsl(r, g, b):
                    r, g, b = r/255.0, g/255.0, b/255.0
                    cmax = max(r, g, b)
                    cmin = min(r, g, b)
                    delta = cmax - cmin

                    l = (cmax + cmin) / 2

                    if delta == 0:
                        h = 0
                        s = 0
                    elif cmax == r:
                        h = ((g - b) / delta) % 6
                    elif cmax == g:
                        h = (b - r) / delta + 2
                    else:
                        h = (r - g) / delta + 4

                    h *= 60

                    if delta == 0:
                        s = 0
                    else:
                        s = delta / (1 - abs(2 * l - 1))

                    return (h, s, l)

                rgb_values = np.array([hex_to_rgb(hex_code) for hex_code in hexcodes])
                hsl_values = np.array([rgb_to_hsl(*rgb) for rgb in rgb_values])

                scaler = StandardScaler()
                hsl_normalized = scaler.fit_transform(hsl_values)

                kmeans = KMeans(n_clusters=n_clusters, random_state=42)
                clusters = kmeans.fit_predict(hsl_normalized)

                sorted_colors = []
                for cluster in range(n_clusters):
                    cluster_colors = [hexcodes[i] for i in range(len(hexcodes)) if clusters[i] == cluster]
                    cluster_hsl = [hsl_values[i] for i in range(len(hexcodes)) if clusters[i] == cluster]
                    sorted_cluster = [x for _, x in sorted(zip(cluster_hsl, cluster_colors), key=lambda pair: (pair[0][0], pair[0][1], pair[0][2]))]
                    sorted_colors.extend(sorted_cluster)

                return {
                    'colors': sorted_colors,
                    'values': [1] * len(sorted_colors)
                }

            result = process_colors(${JSON.stringify(hexcodes)}, ${numClusters})
            json.dumps(result)
        `);

        const plotData = JSON.parse(result);
        const layout = {
            title: 'Color Palette (Sorted by HSL Color Space)',
            xaxis: { title: 'Color Index' },
            yaxis: { title: '' },
            showlegend: false,
            height: 400
        };

        Plotly.newPlot('result', [{
            x: Array.from({ length: plotData.colors.length }, (_, i) => i),
            y: plotData.values,
            type: 'bar',
            marker: { color: plotData.colors },
            hovertext: plotData.colors,
            hoverinfo: 'text'
        }], layout);
    } catch (error) {
        showError(`An error occurred: ${error.message}`);
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}
