// parser.js

function parseInput(input, version = 'v24') {
    input = input.trim();
    if (input.startsWith('{')) {
        try {
            return JSON.parse(input);
        } catch (e) {
            throw new Error("Invalid JSON input: " + e.message);
        }
    }
    return parseInfoFlat(input, version);
}

function parseInfoFlat(input, version = 'v24') {
    const lines = input.split('\n');
    const result = { acl: { 'cpm-filter': {} } };
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // Strip quotes around line values to simplify
        // But for exact string mapping it might be tricky. Let's do it carefully.
        
        if (line.startsWith('set / acl policers ')) {
            const parts = line.replace('set / acl policers ', '').split(' ');
            if (parts.length === 0) continue;
            
            if (parts[0] === 'system-cpu-policer') {
                const policerName = parts[1];
                if (!result.acl.policers) result.acl.policers = { 'system-cpu-policer': [] };
                let policer = result.acl.policers['system-cpu-policer'].find(p => p.name === policerName);
                if (!policer) {
                    policer = { name: policerName };
                    result.acl.policers['system-cpu-policer'].push(policer);
                }
                
                if (parts.length > 2) {
                    if (parts[2] === 'peak-packet-rate') {
                        policer['peak-packet-rate'] = parseInt(parts[3], 10);
                    } else if (parts[2] === 'max-packet-burst') {
                        policer['max-packet-burst'] = parseInt(parts[3], 10);
                    } else if (parts[2] === 'entry-specific') {
                        policer['entry-specific'] = (parts[3] === 'true');
                    }
                }
            }
            continue;
        }

        let filterType = null;
        let isMatch = false;
        let parts = [];
        
        if (version === 'v23' && line.startsWith('set / acl cpm-filter ')) {
            parts = line.replace('set / acl cpm-filter ', '').split(' ');
            if (parts.length === 0) continue;
            filterType = parts[0]; // e.g. ipv4-filter, ipv6-filter
            if (filterType !== 'ipv4-filter' && filterType !== 'ipv6-filter' && filterType !== 'mac-filter') {
                continue;
            }
            isMatch = true;
        } else if (version === 'v24' && line.startsWith('set / acl acl-filter cpm type ')) {
            parts = line.replace('set / acl acl-filter cpm type ', '').split(' ');
            if (parts.length === 0) continue;
            let rawType = parts[0]; 
            if (rawType !== 'ipv4' && rawType !== 'ipv6' && rawType !== 'mac') {
                continue;
            }
            filterType = rawType + '-filter';
            isMatch = true;
        }

        if (isMatch) {
            
            if (!result.acl['cpm-filter'][filterType]) {
                result.acl['cpm-filter'][filterType] = { entry: [] };
            }
            
            if (parts.length > 1 && parts[1] === 'statistics-per-entry') {
                if (parts.length >= 3) {
                    result.acl['cpm-filter'][filterType]['statistics-per-entry'] = (parts[2] === 'true');
                }
                continue;
            }
            
            if (parts.length > 1 && parts[1] === 'entry') {
                if (parts.length < 3) continue;
                const sequenceId = parseInt(parts[2], 10);
                
                let entry = result.acl['cpm-filter'][filterType].entry.find(e => e['sequence-id'] === sequenceId);
                if (!entry) {
                    entry = { 'sequence-id': sequenceId };
                    result.acl['cpm-filter'][filterType].entry.push(entry);
                }
                
                if (parts.length <= 3) continue;
                
                let keyPath = parts.slice(3); // e.g. ["description", "\"To", "drop", "ICMP", "redirect", "packets\""]
                
                if (version === 'v24' && keyPath[0] === 'match' && keyPath.length > 1) {
                    const family = keyPath[1];
                    if (family === 'ipv4' || family === 'ipv6' || family === 'transport') {
                        keyPath.splice(1, 1); // remove the family keyword to align with v23 AST
                    }
                }
                
                if (keyPath[0] === 'description') {
                    const descStr = line.substring(line.indexOf('description') + 12).trim();
                    entry.description = descStr.replace(/^"|"$/g, '');
                } else if (keyPath[0] === 'action') {
                    if (!entry.action) entry.action = {};
                    if (keyPath.length > 1) {
                        const actionType = keyPath[1]; // 'drop' or 'accept'
                        if (!entry.action[actionType]) entry.action[actionType] = {};
                        
                        // Check for rate-limit
                        if (keyPath.length > 2 && keyPath[2] === 'rate-limit') {
                            if (keyPath.length > 3 && keyPath[3] === 'system-cpu-policer') {
                                if (!entry.action[actionType]['rate-limit']) {
                                    entry.action[actionType]['rate-limit'] = {};
                                }
                                entry.action[actionType]['rate-limit']['system-cpu-policer'] = keyPath[4] || true;
                            } else if (keyPath.length > 3 && keyPath[3] === 'policer') {
                                if (!entry.action[actionType]['rate-limit']) {
                                    entry.action[actionType]['rate-limit'] = {};
                                }
                                entry.action[actionType]['rate-limit']['policer'] = keyPath[4];
                            }
                        }
                    }
                } else if (keyPath[0] === 'match') {
                    if (!entry.match) entry.match = {};
                    const mParts = keyPath.slice(1);
                    if (mParts.length === 0) continue;
                    
                    if (mParts[0] === 'protocol') {
                        entry.match.protocol = mParts[1];
                    } else if (mParts[0] === 'next-header') {
                        entry.match['next-header'] = mParts[1];
                    } else if (mParts[0] === 'fragment') {
                        entry.match.fragment = (mParts[1] === 'true');
                    } else if (mParts[0] === 'source-ip') {
                        if (mParts[1] === 'prefix') {
                            if (!entry.match['source-ip']) entry.match['source-ip'] = {};
                            entry.match['source-ip'].prefix = mParts[2];
                        }
                    } else if (mParts[0] === 'destination-ip') {
                        if (mParts[1] === 'prefix') {
                            if (!entry.match['destination-ip']) entry.match['destination-ip'] = {};
                            entry.match['destination-ip'].prefix = mParts[2];
                        }
                    } else if (mParts[0] === 'source-port') {
                        if (!entry.match['source-port']) entry.match['source-port'] = {};
                        if (mParts[1] === 'operator') {
                            entry.match['source-port'].operator = mParts[2]; // e.g. eq
                            if (mParts.length > 3 && mParts[3] === 'value') {
                                entry.match['source-port'].value = parseInt(mParts[4], 10);
                            }
                        } else if (mParts[1] === 'value') {
                            entry.match['source-port'].value = parseInt(mParts[2], 10);
                        } else if (mParts[1] === 'range') {
                            if (!entry.match['source-port'].range) entry.match['source-port'].range = {};
                            if (mParts[2] === 'start') entry.match['source-port'].range.start = parseInt(mParts[3], 10);
                            if (mParts[2] === 'end') entry.match['source-port'].range.end = parseInt(mParts[3], 10);
                        }
                    } else if (mParts[0] === 'destination-port') {
                        if (!entry.match['destination-port']) entry.match['destination-port'] = {};
                        if (mParts[1] === 'operator') {
                            entry.match['destination-port'].operator = mParts[2]; // e.g. eq
                            // sometimes info flat breaks it into two lines:
                            // match destination-port operator eq
                            // match destination-port value 22
                        } else if (mParts[1] === 'value') {
                            entry.match['destination-port'].value = parseInt(mParts[2], 10);
                        } else if (mParts[1] === 'range') {
                            if (!entry.match['destination-port'].range) entry.match['destination-port'].range = {};
                            if (mParts[2] === 'start') entry.match['destination-port'].range.start = parseInt(mParts[3], 10);
                            if (mParts[2] === 'end') entry.match['destination-port'].range.end = parseInt(mParts[3], 10);
                        }
                    } else if (mParts[0] === 'icmp') {
                        if (mParts[1] === 'type') {
                            if (!entry.match.icmp) entry.match.icmp = {};
                            entry.match.icmp.type = mParts[2];
                        }
                    } else if (mParts[0] === 'icmp6') {
                        if (mParts[1] === 'type') {
                            if (!entry.match.icmp6) entry.match.icmp6 = {};
                            entry.match.icmp6.type = mParts[2];
                        }
                    }
                }
            }
        }
    }
    
    return result;
}

window.parseInput = parseInput;
