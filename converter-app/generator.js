// generator.js

function generateYAML(edaResources) {
    if (!edaResources || edaResources.length === 0) {
        return "# No valid entries found to convert.";
    }
    
    let yamlOutput = "";
    
    for (const resource of edaResources) {
        // Use js-yaml to dump the object
        // We set noRefs to true and skipInvalid to true to keep it clean
        try {
            const yamlStr = jsyaml.dump(resource, {
                indent: 2,
                lineWidth: -1, 
                noRefs: true,
                sortKeys: false
            });
            yamlOutput += "---\n" + yamlStr + "\n";
        } catch (e) {
            console.error("YAML Generation Error:", e);
            yamlOutput += `# Error generating YAML for resource ${resource?.metadata?.name}: ${e.message}\n`;
        }
    }
    
    return yamlOutput;
}

window.generateYAML = generateYAML;
