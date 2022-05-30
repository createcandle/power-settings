"""Power Settings API handler."""


import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import json
from time import sleep
import base64
import shutil
import datetime
import functools
import subprocess

try:
    from gateway_addon import APIHandler, APIResponse, Database
    #print("succesfully loaded APIHandler and APIResponse from gateway_addon")
except:
    print("Import APIHandler and APIResponse from gateway_addon failed. Use at least WebThings Gateway version 0.10")

print = functools.partial(print, flush=True)


_TIMEOUT = 3

_CONFIG_PATHS = [
    os.path.join(os.path.expanduser('~'), '.webthings', 'config'),
]

if 'WEBTHINGS_HOME' in os.environ:
    _CONFIG_PATHS.insert(0, os.path.join(os.environ['WEBTHINGS_HOME'], 'config'))



class PowerSettingsAPIHandler(APIHandler):
    """Power settings API handler."""

    def __init__(self, verbose=False):
        """Initialize the object."""
        #print("INSIDE API HANDLER INIT")
        
        self.addon_name = "power-settings"  # overwritteb by data in manifest
        self.DEBUG = False
        
        try:
            manifest_fname = os.path.join(
                os.path.dirname(__file__),
                '..',
                'manifest.json'
            )            
            #self.adapter = adapter
            #print("ext: self.adapter = " + str(self.adapter))

            with open(manifest_fname, 'rt') as f:
                manifest = json.load(f)

            APIHandler.__init__(self, manifest['id'])
            self.manager_proxy.add_api_handler(self)
            self.addon_name = manifest['id']
            
            if self.DEBUG:
                print("self.user_profile: " + str(self.user_profile))
            
            
            # PATHS
            
            self.addon_dir = os.path.join(self.user_profile['addonsDir'], self.addon_name)
            self.data_dir = os.path.join(self.user_profile['dataDir'], self.addon_name)
            
            # MQTT
            self.allow_anonymous_mqtt = False
            self.mosquitto_conf_file_path = '/home/pi/.webthings/etc/mosquitto/mosquitto.conf'
            
            # Candle version
            self.version_file_path = '/boot/candle_version.txt'
            
            # Actions shell script location
            self.actions_file_path = '/boot/bootup_actions.sh'
            
            # Factory reset
            self.keep_z2m_file_path = '/boot/keep_z2m.txt'
            self.keep_bluetooth_file_path = '/boot/keep_bluetooth.txt'
            self.factory_reset_script_path = os.path.join(self.addon_dir, "factory_reset.sh") 
            self.manual_update_script_path = os.path.join(self.addon_dir, "manual_update.sh") 
            
            # Backup addon dir paths
            self.backup_download_dir = os.path.join(self.addon_dir, "backup")
            self.restore_backup_script_path = os.path.join(self.addon_dir, "restore_backup.sh") 
            
            # Backup data dir paths
            self.backup_dir = os.path.join(self.data_dir, "backup") 
            self.backup_file_path = os.path.join(self.backup_dir, "candle_backup.tar")
            
            # Restore
            self.restore_file_path = os.path.join(self.data_dir, "candle_restore.tar")
            
            # Hardware clock
            self.hardware_clock_detected = False
            self.do_not_use_hardware_clock = False
            self.hardware_clock_file_path = '/boot/candle_hardware_clock.txt'
            
            
            # LOAD CONFIG
            try:
                self.add_from_config()
            except Exception as ex:
                print("Error loading config: " + str(ex))
                
            
            
            if self.do_not_use_hardware_clock:
                if os.path.isfile(self.hardware_clock_file_path):
                    if self.DEBUG:
                        print("removing " + str(self.hardware_clock_file_path))
                    run_command('sudo rm ' + str(self.hardware_clock_file_path))
            else:
                self.hardware_clock_check()
            
            # Create local backups directory
            if not os.path.isdir(self.backup_dir):
                if self.DEBUG:
                    print("creating backup directory in data path: " + str(self.backup_dir))
                os.mkdir(self.backup_dir)
            
            
            # Remove old actions script if it survived somehow
            if os.path.isfile(self.actions_file_path):
                print("ERROR: old actions script still exists! Removing it now.")
                os.system('sudo rm ' + str(self.actions_file_path))
                os.system('sudo touch ')
                
            
            # remove old download symlink if it somehow survived
            if os.path.islink(self.backup_download_dir):
                if self.DEBUG:
                    print("unlinking download dir that survived somehow")
                os.system('unlink ' + self.backup_download_dir) # remove symlink, so the backup files can not longer be downloaded
            
            # Remove old restore file if it exists
            if os.path.isfile(self.restore_file_path):
                os.system('rm ' + str(self.restore_file_path))
                if self.DEBUG:
                    print("removed old restore file")
            
            self.update_backup_info()
            
            
            if self.DEBUG:
                print("power settings: self.user_profile: " + str(self.user_profile))
                print("self.addon_dir: " + str(self.addon_dir))
                print("self.actions_file_path: " + str(self.actions_file_path))
                print("self.manager_proxy = " + str(self.manager_proxy))
                print("Created new API HANDLER: " + str(manifest['id']))
                print("user_profile: " + str(self.user_profile))
                print("actions_file_path: " + str(self.actions_file_path))
                print("version_file_path: " + str(self.version_file_path))
                
                print("self.backup_file_path: " + str(self.backup_file_path))
                print("self.backup_download_dir: " + str(self.backup_download_dir))
                
                print("self.mosquitto_conf_file_path: " + str(self.mosquitto_conf_file_path))
                
        except Exception as e:
            print("ERROR, Failed to init UX extension API handler: " + str(e))
        
        
        # Get Candle version
        self.candle_version = "unknown"
        try:
            if os.path.isfile(self.version_file_path):
                with open(self.version_file_path) as f:
                    #self.candle_version = f.readlines()
                    self.candle_version = f.read()
                    self.candle_version = self.candle_version.strip()
                    if self.DEBUG:
                        print("\ncandle_version: " + str(self.candle_version))
                    
        except Exception as ex:
            print("Error getting Candle version: " + str(ex))
        
        #self.backup()
        self.update_backup_info()
        
        
        # Check if anonymous MQTT access is currently allowed
        try:
            with open(self.mosquitto_conf_file_path) as file:

               df = file.read()
               if self.DEBUG:
                   print("mosquitto_conf: " + str(df))
               
               if 'allow_anonymous true' in df:
                   self.allow_anonymous_mqtt = True
                   
        except Exception as ex:
            print("Error reading MQTT config file: " + str(ex))
           
        if self.DEBUG:
            print("self.allow_anonymous_mqtt: " + str(self.allow_anonymous_mqtt))
        
        
        
        
        
    # Read the settings from the add-on settings page
    def add_from_config(self):
        """Attempt to add all configured devices."""
        try:
            database = Database(self.addon_name)
            if not database.open():
                print("Could not open settings database")
                #self.close_proxy()
                return
            
            config = database.load_config()
            database.close()
            
        except Exception as ex:
            print("Error! Failed to open settings database: " + str(ex))
            #self.close_proxy()
        
        if not config:
            print("Error loading config from database")
            return

        if 'Debug' in config:
            self.DEBUG = bool(config['Debug'])
            if self.DEBUG:
                print("-Debug preference was in config: " + str(self.DEBUG))

        if 'Do not use hardware clock' in config:
            self.do_not_use_hardware_clock = bool(config['Do not use hardware clock'])
            if self.DEBUG:
                print("-Do not use hardware clock preference was in config: " + str(self.do_not_use_hardware_clock))

        #self.DEBUG = True # TODO: DEBUG, REMOVE
    
        
        
        
    def hardware_clock_check(self):
        try:
            init_hardware_clock = False
            for line in run_command("sudo i2cdetect -y 1").splitlines():
                if self.DEBUG:
                    print(line)
                if line.startswith( '60:' ):
                    if '-- 68 --' in line or '-- UU --' in line:
                        self.hardware_clock_detected = True
                        if self.DEBUG:
                            print("Hardware clock detected")
                            
                    if '-- 68 --' in line:
                        init_hardware_clock = True
            
            if init_hardware_clock:
                if self.DEBUG:
                    print("Initializing hardware clock")
                os.system('sudo modprobe rtc-ds1307')
                os.system('echo "ds1307 0x68" | sudo tee /sys/class/i2c-adapter/i2c-1/new_device')

                if os.path.isfile(self.hardware_clock_file_path):
                    # The hardware clock has already been set
                    
                    # Check if the hardware clock date is newer?
                    hardware_clock_time = run_command("sudo hwclock -r")
                    if self.DEBUG:
                        print("hardware_clock_time: " + str(hardware_clock_time))
                        
                    hardware_clock_time = hardware_clock_time.rstrip()
                    #hardware_clock_date = datetime.strptime(hardware_clock_time, '%Y-%m-%d')
                    #hardware_clock_date = datetime.datetime.fromisoformat(hardware_clock_time)
                    
                    # "2021-08-08"
                    # 2022-05-24 00:06:26.623920+02:00
                    
                    hardware_clock_date = datetime.datetime.strptime(hardware_clock_time, "%Y-%m-%d %H:%M:%S.%f%z") 
                    if hardware_clock_date.timestamp() > (datetime.datetime.now().timestamp() - 86400):
                        if self.DEBUG:
                            print("SETTING LOCAL CLOCK FROM HARDWARE CLOCK")
                        # Set the system clock based on the hardware clock
                        os.system('sudo hwclock -s')
                    else:
                        # The hardware clock time is more out of date than the software clock. 
                        # Removing the the hardware clock file will cause the clock to be updated from the internet on next reboot.
                        os.system('sudo rm ' + self.hardware_clock_file_path)
                    
                else:
                    # The hardware clock should be set
                    if self.DEBUG:
                        print("Setting initial hardware clock, creating " + str(self.hardware_clock_file_path))
                    os.system('sudo hwclock -w')
                    os.system('sudo touch ' + self.hardware_clock_file_path)
                
            else:
                if self.DEBUG:
                    print("No need to init hardware clock module (does not exist, or has already been initialised). hardware_clock_detected: " + str(self.hardware_clock_detected))
                    
            
        except Exception as ex:
            print("Error in hardware_clock_check: " + str(ex))
        
        


    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        
        try:
        
            if request.method != 'POST':
                return APIResponse(status=404)
            
            if request.path == '/init' or request.path == '/set-time' or request.path == '/set-ntp' or request.path == '/shutdown' or request.path == '/reboot' or request.path == '/restart' or request.path == '/ajax' or request.path == '/save':

                if self.DEBUG:
                    print("-API request at: " + str(request.path))

                try:
                    if request.path == '/ajax':
                        if 'action' in request.body:
                            action = request.body['action']
                        
                            
                            # FACTORY RESET
                            if action == 'reset':
                                
                                reset_z2m = True
                                if 'keep_z2m' in request.body:
                                    reset_z2m = not bool(request.body['keep_z2m'])
                                
                                reset_bluetooth = True
                                if 'keep_bluetooth' in request.body:
                                     reset_bluetooth = not bool(request.body['keep_bluetooth'])
                                
                                if self.DEBUG:
                                    print("creating/removing keep files")
                                
                                # Set the preference files about keeping Z2M and Bluetooth in the boot folder
                                if reset_z2m:
                                    if self.DEBUG:
                                        print("removing keep_z2m.txt")
                                    os.system('sudo rm ' + self.keep_z2m_file_path)
                                else:
                                    if self.DEBUG:
                                        print("creating keep_z2m.txt")
                                    os.system('sudo touch ' + self.keep_z2m_file_path)
                                    
                                if reset_bluetooth:
                                    if self.DEBUG:
                                        print("removing keep_bluetooth.txt")
                                    os.system('sudo rm ' + self.keep_bluetooth_file_path)
                                else:
                                    if self.DEBUG:
                                        print("creating keep_bluetooth.txt")
                                    os.system('sudo touch ' + self.keep_bluetooth_file_path)
                                    
                                
                                # Place the factory reset file in the correct location so that it will be activated at boot.
                                os.system('sudo cp ' + str(self.factory_reset_script_path) + ' ' + str(self.actions_file_path))
                                #textfile = open(self.actions_file_path, "w")
                                #a = textfile.write(reset_z2m)
                                #textfile.close()
                                
                                #os.spawnve(os.P_NOWAIT, "/bin/bash", ["-c", "/home/pi/longrun.sh"])
                                #os.spawnve(os.P_NOWAIT, "/bin/bash", ["-c", "/home/pi/longrun.sh"], os.environ)
                                #os.spawnlpe(os.P_DETACH,"/bin/bash", "/bin/bash", '/home/pi/longrun.sh','&')        
                                #subprocess.Popen(["nohup", "/bin/bash", "~/.webthings/addons/power-settings/factory_reset.sh"])
                                
                                #DETACHED_PROCESS = 0x00000008
                                #CREATE_NEW_PROCESS_GROUP = 0x00000200
                                #pid = Popen([script, param], shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE,
                                #            creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                                #subprocess.Popen(["nohup", "/bin/bash", "/home/pi/longrun.sh", reset_z2m], shell=True, stdin=PIPE, stdout=PIPE, stderr=PIPE,
                                #            creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
                                #os.system('sudo chmod +x ~/.webthings/addons/power-settings/factory_reset.sh') 
                                #os.system('/home/pi/.webthings/addons/power-settings/factory_reset.sh ' + str(reset_z2m) + " &")
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok'}),
                                )
                                
                                
                            # MANUAL UPDATE
                            elif action == 'manual_update':
                                
                                if self.DEBUG:
                                    print("copying manual update script into position")
                                
                                # Place the factory reset file in the correct location so that it will be activated at boot.
                                os.system('sudo cp ' + str(self.manual_update_script_path) + ' ' + str(self.actions_file_path))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok'}),
                                )
                                
                            elif action == 'backup_init':
                                if self.DEBUG:
                                    print("API: in backup_init")
                                
                                state = 'ok'
                                
                                self.update_backup_info()
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state,'backup_exists':self.backup_file_exists,'restore_exists':self.restore_file_exists, 'disk_usage':self.disk_usage}),
                                )
                                
                                
                            elif action == 'create_backup':
                                if self.DEBUG:
                                    print("API: in create_backup")
                                state = 'error'
                                try:
                                    
                                    backup_result = self.backup()
                                    if self.DEBUG:
                                        print("backup result: " + str(backup_result))
                                    if backup_result:
                                        state = 'ok'
                                        
                                except Exception as ex:
                                    print("Error creating backup: " + str(ex))
                                    state = 'error'
                                    
                                self.update_backup_info()
                                    
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state,'backup_exists':self.backup_file_exists,'restore_exists':self.restore_file_exists, 'disk_usage':self.disk_usage}),
                                )
                                
                                
                            
                            elif action == 'unlink_backup_download_dir':
                                
                                state = 'error'
                                if os.path.isdir(self.backup_download_dir):
                                    os.system('unline ' + self.backup_download_dir) # remove symlink, so the backup files can not longer be downloaded
                                    if self.DEBUG:
                                        print("removed symlink")
                                    state = 'ok'
                            
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                            
                            
                            elif action == 'anonymous_mqtt':
                                
                                allow_anonymous_mqtt = False
                                if 'allow_anonymous_mqtt' in request.body:
                                     if request.body['allow_anonymous_mqtt'] == True:
                                         allow_anonymous_mqtt = "true"
                                         if self.DEBUG:
                                             print("set allow_anonymous_mqtt to true")
                                
                                # sed -i 's/allow_anonymous false/allow_anonymous true/' /home/pi/.webthings/etc/mosquitto/mosquitto.conf
                                if allow_anonymous_mqtt:
                                    os.system("sudo sed -i 's/allow_anonymous false/allow_anonymous true/' " + str(self.mosquitto_conf_file_path))
                                else:
                                    os.system("sudo sed -i 's/allow_anonymous true/allow_anonymous false/' " + str(self.mosquitto_conf_file_path))
                                    
                                if self.DEBUG:
                                    print("restarting mosquitto")
                                os.system('sudo systemctl restart mosquitto.service')
                                    
                                self.allow_anonymous_mqtt = allow_anonymous_mqtt
                            
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':True}),
                                )
                            
                            elif action == 'get_stats':
                                
                                total_memory = '?'
                                free_memory = '?'
                                try:
                                    
                                    # check free memory
                                    free_memory = subprocess.check_output(['grep','^MemFree','/proc/meminfo'])
                                    free_memory = free_memory.decode('utf-8')
                                    free_memory = int( int(''.join(filter(str.isdigit, free_memory))) / 1000)
                                    if self.DEBUG:
                                        print("free_memory: " + str(free_memory))
                                    
                                    # Check available memory
                                    available_memory = subprocess.check_output("free | grep Mem:", shell=True)
                                    available_memory = available_memory.decode('utf-8')
                                    available_memory_parts = available_memory.split()
                                    available_memory = available_memory_parts[-1]
                                    available_memory = int( int(''.join(filter(str.isdigit, available_memory))) / 1000)
                                    if self.DEBUG:
                                        print("available_memory: " + str(available_memory))
                                    
                                    # Check total memory in system
                                    total_memory = subprocess.check_output("awk '/^MemTotal:/{print $2}' /proc/meminfo", shell=True)
                                    total_memory = total_memory.decode('utf-8')
                                    total_memory = int( int(''.join(filter(str.isdigit, total_memory))) / 1000)
                                    if self.DEBUG:
                                        print("total_memory: " + str(total_memory))
                                    
                                    self.update_backup_info()
                                    
                                except Exception as ex:
                                    print("Error checking free memory: " + str(ex))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':True, 'total_memory':total_memory, 'available_memory':available_memory, 'free_memory':free_memory, 'disk_usage':self.disk_usage}),
                                )
                                
                            
                            else:
                                return APIResponse(
                                  status=404
                                )
                                
                        else:
                            return APIResponse(
                              status=400
                            )
                        
                        
                    elif request.path == '/init':
                        response = {}
                        
                        if self.DEBUG:
                            print("Initialising")
                        try:
                            now = datetime.datetime.now()
                            current_ntp_state = True
                        
                            try:
                                for line in run_command("timedatectl show").splitlines():
                                    if self.DEBUG:
                                        print(line)
                                    if line.startswith( 'NTP=no' ):
                                        current_ntp_state = False
                            except Exception as ex:
                                print("Error getting NTP status: " + str(ex))
                            
                            response = {'hours':now.hour,'minutes':now.minute,'ntp':current_ntp_state,'backup_exists':self.backup_file_exists,'restore_exists':self.restore_file_exists, 'disk_usage':self.disk_usage, 'allow_anonymous_mqtt':self.allow_anonymous_mqtt, 'hardware_clock_detected':self.hardware_clock_detected,'candle_version':self.candle_version, 'debug':self.DEBUG}
                            if self.DEBUG:
                                print("Init response: " + str(response))
                        except Exception as ex:
                            print("Init error: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps(response),
                        )
                        
                    
                    elif request.path == '/set-time':
                        try:
                            self.set_time(str(request.body['hours']),request.body['minutes'])
                            
                            now = datetime.datetime.now()
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state':True, 'hours':now.hour,'minutes':now.minute}),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error setting time: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps({"state":False}),
                            )

                        
                    elif request.path == '/set-ntp':
                        if self.DEBUG:
                            print("New NTP state = " + str(request.body['ntp']))
                        self.set_ntp_state(request.body['ntp'])
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps("Changed Network Time state to " + str(request.body['ntp'])),
                        )
                
                    elif request.path == '/shutdown':
                        self.shutdown()
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps("Shutting down"),
                        )
                
                    elif request.path == '/reboot':
                        self.reboot()
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps("Rebooting"),
                        )
                        
                    elif request.path == '/restart':
                        self.restart()
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps("Restarting"),
                        )
                        
                        
                    elif request.path == '/save':
                        if self.DEBUG:
                            print("SAVING uploaded file")
                        try:
                            data = []
                            state = 'error'
                            filename = ""
                            filedata = ""
                            
                            
                            # Save file
                            try:
                                filename = request.body['filename']
                                if self.DEBUG:
                                    print("upload provided filename: " + str(filename))
                                if filename.endswith('.tar'):
                                    
                                    
                                    if os.path.isfile(self.restore_file_path):
                                        os.system('rm ' + str(self.restore_file_path))
                                        if self.DEBUG:
                                            print("removed old restore file")
                                    
                                    filedata = str(request.body['filedata'])
                                    #base64_data = re.sub('^data:file/.+;base64,', '', filedata)
                                    #base64_data = base64_data.replace('^data:file/.+;base64,', '', filedata)
                                    if ',' in filedata:
                                        filedata = filedata.split(',')[1]
                                    #sub
                                    if self.DEBUG:
                                        print("saving to file: " + str(self.restore_file_path))
                                    with open(self.restore_file_path, "wb") as fh:
                                        fh.write(base64.b64decode(filedata))
                                        
                                        if self.DEBUG:
                                            print("save complete")
                                        
                                        if os.path.isfile(self.restore_backup_script_path):
                                            restore_command = 'sudo cp ' + str(self.restore_backup_script_path) + ' ' + str(self.actions_file_path)
                                            if self.DEBUG:
                                                print("restore backup copy command: " + str(restore_command))
                                            os.system(restore_command)
                                            
                                            state = 'ok'
                                        else:
                                            print("Error: self.restore_backup_script_path did not exist?")
                                        
                            except Exception as ex:
                                print("Error saving data to file: " + str(ex))
                                state = 'error'
                            #data = self.save_photo(str(request.body['filename']), str(request.body['filedata']), str(request.body['parts_total']), str(request.body['parts_current']) ) #new_value,date,property_id
                            #if isinstance(data, str):
                            #    state = 'error'
                            #else:
                            #    state = 'ok'
                            print("save return state: " + str(state))
                            
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps({'state' : state, 'data' : data}),
                            )
                        except Exception as ex:
                            print("Error saving uploaded file: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps("Error while saving uploaded file: " + str(ex)),
                            )
                        
                    else:
                        return APIResponse(
                          status=500,
                          content_type='application/json',
                          content=json.dumps("API error"),
                        )
                        
                except Exception as ex:
                    if self.DEBUG:
                        print("Power settings server error: " + str(ex))
                    return APIResponse(
                      status=500,
                      content_type='application/json',
                      content=json.dumps("Error"),
                    )
                    
            else:
                return APIResponse(status=404)
                
        except Exception as e:
            if self.DEBUG:
                print("Failed to handle UX extension API request: " + str(e))
            return APIResponse(
              status=500,
              content_type='application/json',
              content=json.dumps("API Error"),
            )
        
    def set_time(self, hours, minutes, seconds=0):
        if self.DEBUG:
            print("Setting the new time")
        
        if hours.isdigit() and minutes.isdigit():
            
            the_date = str(datetime.datetime.now().strftime('%Y-%m-%d'))
        
            time_command = "sudo date --set '" + the_date + " "  + str(hours) + ":" + str(minutes) + ":00'"
            if self.DEBUG:
                print("new set date command: " + str(time_command))
        
            try:
                os.system(time_command)
                
                # If hardware clock module exists, set its time too.
                if self.hardware_clock_detected:
                    print('also setting hardware clock time')
                    os.system('sudo hwclock -w')
                    
            except Exception as e:
                print("Error setting new time: " + str(e))

                
           


    def set_ntp_state(self,new_state):
        if self.DEBUG:
            print("Setting NTP state to: " + str(new_state))
        try:
            if new_state:
                os.system('sudo timedatectl set-ntp on') 
                if self.DEBUG:
                    print("Network time turned on")
            else:
                os.system('sudo timedatectl set-ntp off') 
                if self.DEBUG:
                    print("Network time turned off")
        except Exception as e:
            print("Error changing NTP state: " + str(e))


    def shutdown(self):
        if self.DEBUG:
            print("Power settings: shutting down gateway")
        try:
            os.system('sudo shutdown now') 
        except Exception as e:
            print("Error shutting down: " + str(e))


    def reboot(self):
        if self.DEBUG:
            print("Power settings: rebooting gateway")
        try:
            os.system('sudo reboot') 
        except Exception as e:
            print("Error rebooting: " + str(e))


    def restart(self):
        if self.DEBUG:
            print("Power settings: restarting gateway")
        try:
            os.system('sudo systemctl restart webthings-gateway.service') 
        except Exception as e:
            print("Error rebooting: " + str(e))


    def update_backup_info(self, directory=None):
        if self.DEBUG:
            print("in update_backup_info")
        if directory == None:
            directory = self.user_profile['baseDir']
        self.backup_file_exists = os.path.isfile(self.backup_file_path)
        self.restore_file_exists = os.path.isfile(self.restore_file_path)
        self.disk_usage = shutil.disk_usage(directory)


    def backup(self):
        if self.DEBUG:
            print("in backup")
        try:
            if not os.path.isdir(self.backup_dir):
                if self.DEBUG:
                    print("creating backup directory in data path: " + str(self.backup_dir))
                os.mkdir(self.backup_dir)
                
            if os.path.isfile(self.backup_file_path):
                if self.DEBUG:
                    print("removing old backup file: " + str(self.backup_file_path))
                os.system('rm ' + self.backup_file_path)
                
            if len(self.backup_file_path) > 10:
                backup_command = 'cd ' + str(self.user_profile['baseDir']) + '; find ./config ./data -maxdepth 2 -name "*.json" -o -name "*.yaml" -o -name "*.sqlite3" | tar -cf ' + str(self.backup_file_path) + ' -T -'
                if self.DEBUG:
                    print("Running backup command: " + str(backup_command))
                run_command(backup_command)
            #soft_link = 'ln -s ' + str(self.backup_download_file_path) + " " + str(self.self.backup_download_dir)
            #if self.DEBUG:
            #    print("linking: " + soft_link)
            #os.system(soft_link)
            
            if os.path.isdir(self.backup_dir) and not os.path.islink(self.backup_download_dir) and not os.path.isdir(self.backup_download_dir):
                symlink_command = 'ln -s ' + self.backup_dir + ' ' + self.backup_download_dir
                if self.DEBUG:
                    print("creating symlink command: " + str(symlink_command))
                os.system(symlink_command) # backup files can now be downloaded
            
            return True
        except Exception as ex:
            print("error while creating backup: " + str(ex))
        return False


    def unload(self):
        if self.DEBUG:
            print("Shutting down adapter")
        os.system('sudo timedatectl set-ntp on') # If add-on is removed or disabled, re-enable network time protocol.
        if os.path.islink(self.backup_download_dir):
            os.system('unlink ' + self.backup_download_dir) # remove symlink, so the backup files can not longer be downloaded



def run_command(cmd, timeout_seconds=60):
    try:
        p = subprocess.run(cmd, timeout=timeout_seconds, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, universal_newlines=True)

        if p.returncode == 0:
            #print("command ran succesfully")
            return p.stdout #.decode('utf-8')
            #yield("Command success")
        else:
            if p.stderr:
                return str(p.stderr) # + '\n' + "Command failed"   #.decode('utf-8'))

    except Exception as e:
        print("Error running command: "  + str(e))
        
        
