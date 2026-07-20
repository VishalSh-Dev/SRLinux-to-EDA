// app.js

document.addEventListener('DOMContentLoaded', () => {
    const inputTextArea = document.getElementById('input-text');
    const outputTextArea = document.getElementById('output-text');
    const convertBtn = document.getElementById('convert-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const statusMsg = document.getElementById('status-msg');
    const namespaceInput = document.getElementById('namespace-input');
    const peakRateInput = document.getElementById('peak-rate-input');
    const burstSizeInput = document.getElementById('burst-size-input');
    const versionSelect = document.getElementById('version-select');

    function showStatus(msg, isError = false) {
        statusMsg.textContent = msg;
        statusMsg.style.color = isError ? '#ef4444' : '#10b981';
        statusMsg.style.opacity = '1';
        setTimeout(() => {
            statusMsg.style.opacity = '0';
        }, 3000);
    }

    convertBtn.addEventListener('click', () => {
        const input = inputTextArea.value;
        if (!input.trim()) {
            showStatus('Input is empty', true);
            return;
        }

        try {
            // 1. Parse Input
            const srlVersion = versionSelect ? versionSelect.value : 'v24';
            const parsedData = window.parseInput(input, srlVersion);
            
            // 2. Map to EDA CRD structure
            const namespaceValue = namespaceInput ? namespaceInput.value.trim() : 'default';
            const peakRateValue = peakRateInput ? parseInt(peakRateInput.value, 10) : 1000;
            const burstSizeValue = burstSizeInput ? parseInt(burstSizeInput.value, 10) : 10000;
            
            const edaResources = window.mapToEDA(parsedData, namespaceValue, peakRateValue, burstSizeValue);
            
            // 3. Generate YAML
            const yamlString = window.generateYAML(edaResources);
            
            if (edaResources.length === 0 || yamlString.trim() === '') {
                outputTextArea.value = '# No valid entries found to convert. Please check your input.';
                showStatus('Error: No valid SRLinux ACL entries found.', true);
            } else {
                outputTextArea.value = yamlString;
                showStatus('Conversion successful!', false);
            }
        } catch (error) {
            console.error(error);
            outputTextArea.value = `# Error during conversion:\n# ${error.message}\n\n# Please check the console for more details.`;
            showStatus('Conversion failed', true);
        }
    });

    clearBtn.addEventListener('click', () => {
        inputTextArea.value = '';
        outputTextArea.value = '';
    });

    copyBtn.addEventListener('click', () => {
        const text = outputTextArea.value;
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            showStatus('Copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showStatus('Failed to copy', true);
        });
    });
});
