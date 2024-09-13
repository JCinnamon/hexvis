let pyodide;

async function initializePyodide() {
    try {
        document.getElementById('loading').textContent = 'Loading Pyodide...';
        document.getElementById('loading').classList.remove('hidden');
        
        pyodide = await loadPyodide();
        
        document.getElementById('loading').textContent = 'Loading packages...';
        await pyodide.loadPackage(["numpy", "scikit-learn", "pandas", "micropip"]);
        
        document.getElementById('loading').textContent = 'Installing colormath...';
        await pyodide.runPythonAsync(`
            import micropip
            await micropip.install('colormath')
        `);
        
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
            import pandas as pd
            import numpy as np
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
            from colormath.color_objects import sRGBColor, LCHabColor
            from colormath.color_conversions import convert_color
            import plotly.graph_objects as go

            def hex_to_lch(hex_color):
                hex_color = hex_color.lstrip('#')
                rgb = sRGBColor(*(int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4)))
                return convert_color(rgb, LCHabColor)

            hexcodes = ${JSON.stringify(hexcodes)}
            color_dict = pd.DataFrame({'Hexcode': hexcodes, 'value': [1] * len(hexcodes)})

            lch_values = np.array([hex_to_lch(hex_code).get_value_tuple() for hex_code in color_dict['Hexcode']])
            scaler = StandardScaler()
            lch_normalized = scaler.fit_transform(lch_values)

            n_clusters = ${numClusters}
            kmeans = KMeans(n_clusters=n_clusters, random_state=42)
            color_dict['cluster'] = kmeans.fit_predict(lch_normalized)

            def sort_colors_lch(colors):
                lch_colors = [hex_to_lch(c).get_value_tuple() for c in colors]
                return [x for _, x in sorted(zip(lch_colors, colors), key=lambda pair: (pair[0][2], pair[0][1], pair[0][0]))]

            sorted_colors = []
            for cluster in range(n_clusters):
                cluster_data = color_dict[color_dict['cluster'] == cluster]
                sorted_cluster_colors = sort_colors_lch(cluster_data['Hexcode'].tolist())
                sorted_colors.extend(sorted_cluster_colors)

            # Create a plotly figure
            fig = go.Figure(data=[go.Bar(
                x=list(range(len(sorted_colors))),
                y=[1] * len(sorted_colors),
                marker_color=sorted_colors,
                hovertext=sorted_colors,
                hoverinfo='text'
            )])

            fig.update_layout(
                title='Color Palette (Sorted by LCH Color Space)',
                xaxis_title='Color Index',
                yaxis_title='',
                showlegend=False,
                height=400
            )

            return fig.to_json()
        `);

        const plotlyJson = JSON.parse(result);
        Plotly.newPlot('result', plotlyJson.data, plotlyJson.layout);
    } catch (error) {
        showError(`An error occurred: ${error.message}`);
    } finally {
        document.getElementById('loading').classList.add('hidden');
    }
}
