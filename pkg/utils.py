import os
#import re
#import sys
import subprocess




def run_command(cmd, timeout_seconds=60):
    try:
        my_env = os.environ.copy()
        if not 'DBUS_SESSION_BUS_ADDRESS' in my_env:
            #print("WARNING, had to add DBUS_SESSION_BUS_ADDRESS to environment variables")
            my_env['DBUS_SESSION_BUS_ADDRESS'] = 'unix:path=/run/user/1000/bus' #str(run_command('echo $DBUS_SESSION_BUS_ADDRESS')).strip()
        if not 'XDG_RUNTIME_DIR' in my_env:
            #print("WARNING, had to add XDG_RUNTIME_DIR to environment variables")
            my_env['XDG_RUNTIME_DIR'] = '/run/user/1000'
        
        
        p = subprocess.run(cmd, env=my_env, timeout=timeout_seconds, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, universal_newlines=True, text=True)

        if p.returncode == 0:
            result_string = p.stdout;
            if type(result_string) == 'bytes':
                #print("result string was bytes: ", result_string)
                result_string = result_string.split(b'\x00')
                result_string = result_string.decode('UTF-8')
                
                #result_string = result_string.replace(b'\x00','')
            #result_string = result_string.replace('\x00','')
            #print("result_string: ", type(result_string))
            
            #if type(result_string) != 'str':
            #    result_string = result_string.decode('UTF-8')
            #print("command ran succesfully")
            return result_string #p.stdout.decode('UTF-8') #.decode('utf-8')
            #yield("Command success")
        else:
            if p.stderr:
                return str(p.stderr) # + '\n' + "Command failed"   #.decode('utf-8'))

    except Exception as e:
        print("Error running command: "  + str(e) + ", cmd was: " + str(cmd))
        
        
def valid_ip(ip):
    valid = False
    try:
        if ip.count('.') == 3 and \
            all(0 <= int(num) < 256 for num in ip.rstrip().split('.')) and \
            len(ip) < 16 and \
            all(num.isdigit() for num in ip.rstrip().split('.')):
            valid = True
    except Exception as ex:
        #print("error in valid_ip: " + str(ex))
        pass
    return valid


def valid_mac(mac):
    return mac.count(':') == 5 and \
        all(0 <= int(num, 16) < 256 for num in mac.rstrip().split(':')) and \
        not all(int(num, 16) == 255 for num in mac.rstrip().split(':'))
    
    
def get_pipewire_audio_controls(debug=False):
    if debug:
        print("in get_pipewire_audio_controls.")
        #print("whoami?? " + str(run_command('strace -e connect pw-dump >/dev/null')))
    result = {'sinks':{},'sources':{},'default_audio_sink_name':None,'default_audio_sink_nice_name':None,'default_audio_sink_id':None,'default_audio_source_name':None,'default_audio_source_nice_name':None,'default_audio_source_id':None}
    nodes = {}
    node = {}
    
    #TODO: future version might just get pw-dump, as it returns lots of information in JSON format
    
    pw_metadata_result = run_command('pw-metadata') 
    lines = pw_metadata_result.splitlines()
    for line in lines:
        if debug:
            print("pw-metadata line: " + str(line))
        if "'default.audio.sink'" in line and '"name":"' in line and '"}' in line:
            name = str(line.split('"name":"')[1])
            if '"}' in name:
                result['default_audio_sink_name'] = str(name.split('"}')[0])  
        if "'default.audio.source'" in line and '"name":"' in line and '"}' in line:
            name = str(line.split('"name":"')[1])
            if '"}' in name:
                result['default_audio_source_name'] = str(name.split('"}')[0])
    
    
    pw_nodes_result = run_command('pw-cli ls Node') 
    lines = pw_nodes_result.splitlines()
    lines.append(' id 999999, ')
    for line in lines:
        if debug:
            print("pipewire node line: " + str(line))
        if 'id ' in line and ',' in line:
            if debug:
                print("\nid spotted in line")
            if 'id' in node:
                if debug:
                    print("id spotted in node too, adding it to nodes dict")
                if 'media_class' in node and (node['media_class'] == 'Audio/Sink' or node['media_class'] == 'Audio/Source'):
                    #if node['media_class'].startswith('Video/'):
                    #    pass
                    #else:
                #elif 'object_path' in node:
                    if debug:
                        print("\npipewire node - name_nick?: " + str(node))
                    nice_name = 'Audio output ' + str(node['id'])
                    if 'node_nick' in node:
                        nice_name = str(node['node_nick'])
                    elif 'node_description' in node:
                        nice_name = str(node['node_description'])
                    if len(nice_name) > 25 and ' ' in nice_name:
                        nice_name = nice_name.split(' ')[-1]
                    node['nice_name'] = nice_name
                    
                    try:
                        node['volume'] = int(100 * float(run_command('wpctl get-volume ' + str(node['id']) ).replace('Volume: ','').strip()))
                        if node['volume'] < 0:
                            node['volume'] = 0
                        if node['volume'] > 100:
                            node['volume'] = 100
                        if debug:
                            print("Volume: " + str(node['volume']))
                    except Exception as ex:
                        print("Error getting pipewire node volume: " + str(ex))
                        
                    #if 'capture' in node['object_path']:
                    if node['media_class'] == 'Audio/Source':
                        result['sources'][node['id']] = node
                        if result['default_audio_source_name'] != None:
                            if 'node_name' in node and node['node_name'] == result['default_audio_source_name']:
                                result['default_audio_source_id'] = node['id']
                                result['default_audio_source_nice_name'] = node['nice_name']
                    
                    #if 'playback' in node['object_path']:
                    if node['media_class'] == 'Audio/Sink':
                        result['sinks'][node['id']] = node
                        if result['default_audio_sink_name'] != None:
                            if 'node_name' in node and node['node_name'] == result['default_audio_sink_name']:
                                result['default_audio_sink_id'] = node['id']
                                result['default_audio_sink_nice_name'] = node['nice_name']
                    
            
            new_id = line.split('id ')[1]
            new_id = new_id.split(', type')[0]
            node = {'id':new_id.strip()}
            
        elif '=' in line:
            if debug:
                print(" = spotted")
            parts = line.split('=')
            if len(parts) == 2:
                attr = str(parts[0]).replace('.','_')
                val = str(parts[1]).replace('"','')
                if debug:
                    print("split into: " + str(parts))
                    print("  attr: " + str(attr))
                    print("  val : " + str(val))
                    
                node[attr.strip()] = val.strip()
                      
    return result