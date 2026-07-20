// mapper.js

function mapToEDA(srlJson, namespace = 'default', defaultPeakRate = 1000, defaultBurstSize = 10000) {
    const resources = [];
    
    if (!srlJson || !srlJson.acl || !srlJson.acl['cpm-filter']) return resources;
    const filters = srlJson.acl['cpm-filter'];
    
    for (const [filterType, filterData] of Object.entries(filters)) {
        if (!filterData || !filterData.entry || filterData.entry.length === 0) continue;
        
        let edaType = 'Auto';
        if (filterType === 'ipv4-filter') edaType = 'IPv4';
        else if (filterType === 'ipv6-filter') edaType = 'IPv6';
        else if (filterType === 'mac-filter') edaType = 'MAC';
        
        const crd = {
            apiVersion: 'filters.eda.nokia.com/v1',
            kind: 'ControlPlaneFilter',
            metadata: {
                name: filterType,
                namespace: namespace || 'default'
            },
            spec: {
                entries: []
            }
        };

        if (filterData['statistics-per-entry'] !== undefined) {
            crd.spec.statisticsPerEntry = filterData['statistics-per-entry'];
        }
        
        for (const entry of filterData.entry) {
            const edaEntry = {
                type: edaType
            };
            
            if (entry.description) {
                edaEntry.description = entry.description;
            }
            
            const ipEntry = {};
            
            // Map actions
            if (entry.action) {
                if (entry.action.accept) {
                    ipEntry.action = 'Accept';
                    if (entry.action.accept['rate-limit']) {
                        const sysCpuPolicer = entry.action.accept['rate-limit']['system-cpu-policer'];
                        if (sysCpuPolicer) {
                            ipEntry.action = 'RateLimit';
                            
                            let peakRate = defaultPeakRate;
                            let burstSize = defaultBurstSize;
                            
                            if (srlJson.acl && srlJson.acl.policers && srlJson.acl.policers['system-cpu-policer']) {
                                const policerName = typeof sysCpuPolicer === 'string' ? sysCpuPolicer : null;
                                if (policerName) {
                                    const pDef = srlJson.acl.policers['system-cpu-policer'].find(p => p.name === policerName);
                                    if (pDef) {
                                        if (pDef['peak-packet-rate'] !== undefined) peakRate = pDef['peak-packet-rate'];
                                        if (pDef['max-packet-burst'] !== undefined) burstSize = pDef['max-packet-burst'];
                                    }
                                }
                            }
                            
                            ipEntry.rateLimit = {
                                peakRateKbps: peakRate,
                                burstSizeBytes: burstSize
                            };
                        } else if (entry.action.accept['rate-limit']['policer']) {
                            ipEntry.action = 'RateLimit';
                            ipEntry.rateLimit = {
                                peakRateKbps: defaultPeakRate,
                                burstSizeBytes: defaultBurstSize
                            };
                        } else {
                            ipEntry.action = 'Accept';
                        }
                    } else {
                        ipEntry.action = 'Accept';
                    }
                } else if (entry.action.drop) {
                    ipEntry.action = 'Drop';
                }
            }
            
            // Map matches
            if (entry.match) {
                if (entry.match.protocol) {
                    ipEntry.protocolName = entry.match.protocol.toUpperCase();
                } else if (entry.match['next-header'] !== undefined) {
                    const nh = entry.match['next-header'].toString();
                    if (!isNaN(nh)) {
                        ipEntry.protocolNumber = parseInt(nh, 10);
                    } else {
                        ipEntry.protocolName = nh.toUpperCase();
                    }
                }
                
                if (entry.match.fragment) {
                    ipEntry.fragment = true;
                }
                
                if (entry.match['source-ip'] && entry.match['source-ip'].prefix) {
                    ipEntry.sourcePrefix = entry.match['source-ip'].prefix;
                }
                
                if (entry.match['destination-ip'] && entry.match['destination-ip'].prefix) {
                    ipEntry.destinationPrefix = entry.match['destination-ip'].prefix;
                }
                
                const mapPort = (portObj, prefix) => {
                    if (portObj.operator) {
                        ipEntry[`${prefix}PortOperator`] = portObj.operator === 'eq' ? 'Equals' : 
                                                          (portObj.operator === 'ge' ? 'GreaterOrEquals' : 'LessOrEquals');
                    }
                    if (portObj.value !== undefined) {
                        ipEntry[`${prefix}PortNumber`] = portObj.value;
                    }
                    if (portObj.range) {
                        ipEntry[`${prefix}PortRange`] = `${portObj.range.start}-${portObj.range.end}`;
                    }
                };
                
                if (entry.match['source-port']) mapPort(entry.match['source-port'], 'source');
                if (entry.match['destination-port']) mapPort(entry.match['destination-port'], 'destination');
                
                if (entry.match.icmp && entry.match.icmp.type) {
                    ipEntry.icmpTypeName = toPascalCase(entry.match.icmp.type);
                } else if (entry.match.icmp6 && entry.match.icmp6.type) {
                    ipEntry.icmpTypeName = toPascalCase(entry.match.icmp6.type);
                }
            }
            
            if (Object.keys(ipEntry).length > 0) {
                if (edaType === 'MAC') {
                    edaEntry.macEntry = ipEntry; 
                } else {
                    edaEntry.ipEntry = ipEntry;
                }
            } else if (!ipEntry.action) {
                // If there's no match and no action derived, let's at least put the action if it existed
                // Actually we mapped action into ipEntry.
                // If ipEntry is completely empty (no action, no match), skip attaching it.
            }
            
            crd.spec.entries.push(edaEntry);
        }
        
        resources.push(crd);
    }
    
    return resources;
}

function toPascalCase(str) {
    return str.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
}

window.mapToEDA = mapToEDA;
