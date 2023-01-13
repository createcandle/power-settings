"""Power Settings API handler."""

# list read-only mounts
# grep "[[:space:]]ro[[:space:],]" /proc/mounts 

# Even simpler, this returns 'ro' or 'rw' depending on the overlay state
# cat /proc/mounts | grep /ro | awk '{print substr($4,1,2)}'

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
    print("Import APIHandler and APIResponse from gateway_addon failed. Your controller is much too old")

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
            
            self.addon_dir = os.path.join(self.user_profile['addonsDir'], self.addon_name)
            self.data_dir = os.path.join(self.user_profile['dataDir'], self.addon_name)
            # baseDir is another useful option in user_profile
            
            # MQTT
            self.allow_anonymous_mqtt = False
            self.mosquitto_conf_file_path = '/home/pi/.webthings/etc/mosquitto/mosquitto.conf'
            
            
            self.bits = 32
            try:
                bits_check = run_command('getconf LONG_BIT')
                self.bits = int(bits_check)
            except Exception as ex:
                print("error getting bits of system: " + str(ex))
            
            
            # Backup
            self.backup_more = False # May be set to true in the UI, in which case logs and photos are also backuped
            self.backup_logs_failed = False
            self.backup_photos_failed = False
            self.uploads_dir_path = os.path.join(self.user_profile['baseDir'], 'uploads')
            self.photos_dir_path = os.path.join(self.user_profile['dataDir'],'photo-frame','photos')
            self.photo_frame_installed = False
            if os.path.isdir(self.photos_dir_path):
                self.photo_frame_installed = True
            
            # Bootup actions
            self.actions_file_path = '/boot/bootup_actions.sh' # run before the gateway starts
            self.post_actions_file_path = '/boot/post_bootup_actions.sh' # run 'after' the gateway starts
            self.late_sh_path = '/home/pi/candle/late.sh'
            self.system_update_error_detected = False
            
            # Factory reset
            self.keep_z2m_file_path = '/boot/keep_z2m.txt'
            self.keep_bluetooth_file_path = '/boot/keep_bluetooth.txt'
            self.factory_reset_script_path = os.path.join(self.addon_dir, "factory_reset.sh") 
            self.manual_update_script_path = os.path.join(self.addon_dir, "manual_update.sh") 
            
            self.system_update_script_path = os.path.join(self.data_dir, "create_latest_candle.sh") 
            self.live_system_update_script_path = os.path.join(self.data_dir, "live_system_update.sh") 
            
            # Backup addon dir paths
            self.backup_download_dir = os.path.join(self.addon_dir, "backup")
            self.restore_backup_script_path = os.path.join(self.addon_dir, "restore_backup.sh") 
            
            # Backup data dir paths
            self.backup_dir = os.path.join(self.data_dir, "backup") 
            self.backup_file_path = os.path.join(self.backup_dir, "candle_backup.tar")
            
            # Backup data logs path
            self.log_db_file_path = os.path.join(self.user_profile['baseDir'], 'log','logs.sqlite3')
            
            # Restore
            self.restore_file_path = os.path.join(self.data_dir, "candle_restore.tar")
            
            # Candle version fie path
            self.version_file_path = '/boot/candle_version.txt'
            self.original_version_file_path = '/boot/candle_original_version.txt'
            
            # Hardware clock
            self.hardware_clock_detected = False
            self.do_not_use_hardware_clock = False
            self.hardware_clock_file_path = '/boot/candle_hardware_clock.txt'
            
            # Low voltage
            self.low_voltage = False
            
            
            # System updates
            self.bootup_actions_failed = False
            self.live_update_attempted = False
            self.system_update_in_progress = False
            
            self.ro_exists = False
            if os.path.isdir('/ro'):
                self.ro_exists = True
                
            self.files_check_exists = False
            if os.path.isfile('/home/pi/candle/files_check.sh'):
                self.files_check_exists = True
                
            
            # LOAD CONFIG
            try:
                self.add_from_config()
            except Exception as ex:
                print("Error loading config: " + str(ex))
                
            
            if self.DEBUG:
                print("System bits: " + str(self.bits))
           
            # Remove hardware clock file if it exists and it should not be enabled
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
            
            
            # Remove rw-once file
            if os.path.isfile('/boot/candle_rw_once.txt'):
                os.system('sudo rm /boot/candle_rw_once.txt')
                if self.DEBUG:
                    print("On next reboot the controller will be read-only again")
            else:
                if self.DEBUG:
                    print("no candle_rw.txt file spotted")
            
            if os.path.isfile('/boot/bootup_actions.sh'):
                print("bootup_actions.sh already exists. Maybe power-settings addon was restarted after preparing an update?")
                os.system('sudo rm /boot/bootup_actions.sh')
            
            if os.path.isfile('/boot/bootup_actions_failed.sh'):
                self.bootup_actions_failed = True 
                
                # clean up the bootup_actions file regardless because it will keep running even if the file is deleted
                os.system('sudo rm /boot/bootup_actions_failed.sh')
                if self.DEBUG:
                    print("/boot/bootup_actions_failed.sh detected")
                    
            
            if os.path.isfile('/boot/candle_stay_rw.txt'):
                if self.DEBUG:
                    print("Note: Candle is in permanent RW mode.")
            
            
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
            
            
            self.update_needs_two_reboots = False
            if not os.path.isfile('/boot/candle_original_version.txt'):
                self.update_needs_two_reboots = True
            
            
            self.check_update_processes()
            
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
                print("original_version_file_path: " + str(self.original_version_file_path))
                print("self.backup_file_path: " + str(self.backup_file_path))
                print("self.backup_download_dir: " + str(self.backup_download_dir))
                
                print("self.mosquitto_conf_file_path: " + str(self.mosquitto_conf_file_path))
                
        except Exception as e:
            print("ERROR, Failed to init UX extension API handler: " + str(e))
        
        self.old_overlay_active = False
        self.post_bootup_actions_supported = False
        
        # Get Candle version
        self.candle_version = "unknown"
        self.candle_original_version="unknown"
        try:
            if os.path.isfile(self.version_file_path):
                with open(self.version_file_path) as f:
                    #self.candle_version = f.readlines()
                    self.candle_version = f.read()
                    self.candle_version = self.candle_version.strip()
                    if self.DEBUG:
                        print("\nself.candle_version: " + str(self.candle_version))
                        
            if os.path.isfile(self.original_version_file_path):
                with open(self.original_version_file_path) as f:
                    #self.candle_version = f.readlines()
                    self.candle_original_version = f.read()
                    self.candle_original_version = self.candle_original_version.strip()
                    if self.DEBUG:
                        print("\nself.candle_original_version: " + str(self.candle_original_version))


            if os.path.isfile('/boot/cmdline.txt'):
                with open('/boot/cmdline.txt') as f:
                    #self.candle_version = f.readlines()
                    cmdline = f.read()
                    if "boot=overlay" in cmdline:
                        if self.DEBUG:
                            print("detected old raspi-config overlay")
                        self.old_overlay_active = True
                    
            
            if os.path.isfile(str(self.late_sh_path)):
                with open(str(self.late_sh_path)) as f:
                    #self.candle_version = f.readlines()
                    late_sh_contents = f.read()
                    if "post_bootup_actions" in late_sh_contents:
                        if self.DEBUG:
                            print("post_bootup_actions are supported")
                        self.post_bootup_actions_supported = True
            

        except Exception as ex:
            print("Error getting Candle versions: " + str(ex))
        
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
            print("Error loading config from database. Using defaults.")
            return

        

        if 'Debug' in config:
            self.DEBUG = bool(config['Debug'])
            if self.DEBUG:
                print("-Debug preference was in config: " + str(self.DEBUG))

        if 'Do not use hardware clock' in config:
            self.do_not_use_hardware_clock = bool(config['Do not use hardware clock'])
            if self.DEBUG:
                print("-Do not use hardware clock preference was in config: " + str(self.do_not_use_hardware_clock))

        #if 'Backup more' in config:
        #    self.backup_more = bool(config['Backup more'])
        #    if self.DEBUG:
        #        print("-Backup more preference was in config: " + str(self.backup_more))

        #self.DEBUG = True # TODO: DEBUG, REMOVE
    
        
        
    def check_update_processes(self):
        check_bootup_actions_running = run_command("sudo ps aux | grep bootup_action")
        if "/boot/bootup_actions" in check_bootup_actions_running:
            print("BOOTUP ACTIONS SEEMS TO BE RUNNING!")
            self.system_update_in_progress = True
        if "/boot/post_bootup_actions" in check_bootup_actions_running:
            print("POST BOOTUP ACTIONS SEEMS TO BE RUNNING!")
            self.system_update_in_progress = True
        
        check_bootup_actions_running = run_command("sudo ps aux | grep live_system_updat")
        if "live_system_update" in check_bootup_actions_running:
            print("LIVE UPDATE SEEMS TO BE RUNNING!")
            self.system_update_in_progress = True
            
        check_bootup_actions_running = run_command("sudo ps aux | grep 'live update in chroo")
        if "live update in chroot" in check_bootup_actions_running:
            print("LIVE UPDATE SEEMS TO BE RUNNING!")
            self.system_update_in_progress = True
        
        
        
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
                    # The hardware clock should be set
                    if self.DEBUG:
                        print("Setting initial hardware clock, creating " + str(self.hardware_clock_file_path))
                    os.system('sudo hwclock -w')
                    os.system('sudo touch ' + self.hardware_clock_file_path)
                
            else:
                if self.DEBUG:
                    print("No need to init hardware clock module (does not exist, or has already been initialised). hardware_clock_detected: " + str(self.hardware_clock_detected))
                if os.path.isfile(self.hardware_clock_file_path):
                    os.system('sudo rm ' + str(self.hardware_clock_file_path))
            
        except Exception as ex:
            if self.DEBUG:
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
                                #os.system('sudo cp ' + str(self.manual_update_script_path) + ' ' + str(self.actions_file_path))
                                os.system('sudo touch /boot/candle_rw_once.txt')
                                os.system('sudo cp ' + str(self.manual_update_script_path) + ' ' + str(self.actions_file_path))
                                
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok'}),
                                )
                                
                                
                            # /disable_overlay - Disable old RO overlay on older Candle systems.
                            elif action == 'disable_overlay':
                                if self.DEBUG:
                                    print("APi request to disable_overlay")
                                state = True
                                
                                try:
                                    if os.path.isdir('/ro') or os.path.isfile('/bin/ro-root.sh'):
                                        #os.system('sudo touch /boot/bootup_actions_non_blocking.txt')
                                        os.system('sudo touch /boot/candle_rw_once.txt')
                                        if not os.path.isfile('/boot/candle_rw_once.txt'):
                                            state = False
                                            
                                    if self.old_overlay_active:
                                        if self.DEBUG:
                                            print("disabling old raspi-config overlay system")
                                        os.system('sudo raspi-config nonint disable_bootro')
                                        os.system('sudo raspi-config nonint disable_overlayfs')
                                
                                    if os.path.isfile('/boot/cmdline.txt'):
                                        with open('/boot/cmdline.txt') as f:
                                            #self.candle_version = f.readlines()
                                            cmdline = f.read()
                                            if "boot=overlay" in cmdline:
                                                if self.DEBUG:
                                                    print("Error, old overlay still active")
                                                state == False
                                            else:
                                                if self.DEBUG:
                                                    print("Old overlay is gone from /boot/cmdline.txt")
                                        
                                except Exception as ex:
                                    if self.DEBUG:
                                        print("Error in /disable_overlay: " + str(ex))
                                    
                                # Place the factory reset file in the correct location so that it will be activated at boot.
                                #os.system('sudo cp ' + str(self.manual_update_script_path) + ' ' + str(self.actions_file_path))
                                #os.system('sudo touch /boot/candle_rw_once.txt')
                                #os.system('sudo sed -i 's/boot=overlay/ /' /boot/cmdline.txt')
                                #os.system('sudo reboot')
                                
                                if self.DEBUG:
                                    print("disable_overlay final state: " + str(state))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                                
                                
                                
                            # SYSTEM UPDATE UPDATE
                            elif action == 'start_system_update':
                                self.system_update_in_progress = False
                                if self.system_update_error_detected:
                                    os.system('sudo pkill -f create_latest_candle')
                                    self.system_update_error_detected = False
                                
                                try:
                                    state = False
                                
                                    # TODO: check if there is enough disk space. This could actually be done client side
                                
                                    if 'cutting_edge' in request.body:
                                        if request.body['cutting_edge'] == True:
                                            os.system('sudo touch /boot/candle_cutting_edge.txt')
                                            if self.DEBUG:
                                                print("created /boot/candle_cutting_edge.txt file")
                                        else:
                                            if os.path.isfile('/boot/candle_cutting_edge.txt'):
                                                os.system('sudo rm /boot/candle_cutting_edge.txt')
                                                if self.DEBUG:
                                                    print("removed /boot/candle_cutting_edge.txt file")
                                
                                
                                    if self.DEBUG:
                                        print("copying system update script into position")
                                
                                    live_update = False
                                    if 'live_update' in request.body:
                                        if request.body['live_update'] == True:
                                            live_update = True
                                
                                    if live_update and os.path.isdir('/ro'):
                                    
                                        # Check if script isn't already running
                                        already_running_check = run_command('ps aux | grep -q live_system_update')
                                        if not "live_system_update.sh" in already_running_check:
                                    
                                    
                                            if os.path.isfile( str(self.live_system_update_script_path) ):
                                                if self.DEBUG:
                                                    print("removing old live update script first")
                                                os.system('rm ' + str(self.live_system_update_script_path))    
                                    
                                            os.system('wget https://raw.githubusercontent.com/createcandle/install-scripts/main/live_system_update.sh -O ' + str(self.live_system_update_script_path))
                                    
                                            if os.path.isfile( str(self.live_system_update_script_path) ):
                                                if self.live_update_attempted == False:
                                                    if self.DEBUG:
                                                        print("Attempting a live update")
                                                    state = True
                                                    self.system_update_in_progress = True
                                                    os.system('cat ' + str(self.live_system_update_script_path) + ' | sudo REBOOT_WHEN_DONE=yes bash &')
                                                else:
                                                    if self.DEBUG:
                                                        print("Error. cannot run two live updates in a row.")
                                        
                                                self.live_update_attempted = True
                                        
                                            else:
                                                if self.DEBUG:
                                                    print("ERROR, live update script failed to download")
                                        else:
                                            if self.DEBUG:
                                                print("Scripts seems to be running already, aborting")
                                
                                    else:
                                        if self.DEBUG:
                                            print("Attempting a reboot-update")
                                        # Place the factory reset file in the correct location so that it will be activated at boot.
                                        #os.system('sudo cp ' + str(self.manual_update_script_path) + ' ' + str(self.actions_file_path))
                                        if not os.path.isdir('/ro') and self.old_overlay_active == False:
                                            
                                            if os.path.isfile('/boot/candle_cutting_edge.txt'):
                                                os.system('wget https://raw.githubusercontent.com/createcandle/install-scripts/main/create_latest_candle_dev.sh -O ' + str(self.system_update_script_path))
                                            else:
                                                os.system('wget https://raw.githubusercontent.com/createcandle/install-scripts/main/create_latest_candle.sh -O ' + str(self.system_update_script_path))
                                            
                                            if os.path.isfile(self.system_update_script_path):
                                                if self.DEBUG:
                                                    print("system update script succesfully downloaded to data dir")
                                                
                                                use_post_bootup = False # temporarily disabling this; how to get environment variables in there?
                                                if self.post_bootup_actions_supported and use_post_bootup == True:
                                                
                                                    # After the reboot, start the script automatically by the system. This is preferable to python running the script.
                                                    
                                                    if os.path.isfile(str(self.post_actions_file_path)):
                                                        if self.DEBUG:
                                                            print("warning, a post bootup actions script was already in place. Deleting it first.")
                                                        os.system('sudo rm ' + str(self.post_actions_file_path) )
                                                
                                                    move_command = 'sudo mv -f ' + str(self.system_update_script_path) + ' ' + str(self.post_actions_file_path)
                                                    if self.DEBUG:
                                                        print("post actions move command: " + str(move_command))
                                                    os.system(move_command)
                                        
                                                    if os.path.isfile( str(self.post_actions_file_path)):
                                                        
                                                        os.system('sudo touch /boot/candle_rw_once.txt')
                                                        
                                                        if self.old_overlay_active:
                                                            if self.DEBUG:
                                                                print("disabling old raspi-config overlay system")
                                                            os.system('sudo raspi-config nonint disable_bootro')
                                                            os.system('sudo raspi-config nonint disable_overlayfs')
                                                        
                                                        #os.system('sudo reboot')
                                            
                                                        #raspi-config nonint disable_bootro
                                                        #raspi-config nonint enable_overlayfs
                                                        #raspi-config nonint disable_bootro
                                            
                                                        #os.system('sudo touch /boot/bootup_actions_non_blocking.txt')
                                                        
                                                        
                                                        state = True
                                                        #os.system('( sleep 5 ; sudo reboot ) & ')
                                                    else:
                                                        if self.DEBUG:
                                                            print("Error, move command failed")
                                                
                                                
                                                # If the system does not support post-bootup actions, then we need to get creative.
                                                # - user must disable read-only FS first
                                                # - after a reboot Python will run the script. Not optimal, since if python/gateway stops, the update scripts stops too.
                                                else:
                                                    
                                                    os.system('sudo chmod +x ' + str(self.system_update_script_path))
                                                
                                                    self.system_update_in_progress = True
                                                    state = True
                                                
                                                    env = {
                                                        **os.environ,
                                                        "SKIP_PARTITIONS": "yes",
                                                        "STOP_EARLY":"yes",
                                                        "REBOOT_WHEN_DONE":"yes"
                                                    }
                                                    
                                                    subprocess.Popen('cat ' + str(self.system_update_script_path) + ' | sudo SKIP_PARTITIONS=yes STOP_EARLY=yes REBOOT_WHEN_DONE=yes bash', shell=True, env=env)
                                                
                                                #start_command = 'cat ' + str(self.system_update_script_path) + ' | sudo SKIP_PARTITIONS=yes STOP_EARLY=yes REBOOT_WHEN_DONE=yes bash &'
                                                #curl -sSl https://raw.githubusercontent.com/createcandle/install-scripts/main/create_latest_candle.sh | sudo SKIP_PARTITIONS=yes STOP_EARLY=yes REBOOT_WHEN_DONE=yes bash
                                                
                                                    
                                            else:
                                                if self.DEBUG:
                                                    print("ERROR, download of update script failed")
                                                
                                        else:
                                            if self.DEBUG:
                                                print("ERROR, overlay is still active?")
                                                
                                            
                                except Exception as ex:
                                    print("Api: error in handling start_system_upate: " + str(ex))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state,'live_update':live_update}),
                                )
                                
                                
                                
                            # /poll
                            elif action == 'poll':
                                if self.DEBUG:
                                    print("handling poll action")
                                
                                dmesg_lines = ""
                                try:
                                    if self.system_update_in_progress:
                                        dmesg_output = run_command("dmesg --level=err,warn | grep Candle")
                                        if dmesg_output != None:
                                            if dmesg_output != "":
                                                for line in dmesg_output.splitlines():
                                                    if "starting update" in line:
                                                        dmesg_lines = line + "\n"
                                                    else:
                                                        line = line[line.find(']'):]
                                                        line = line.replace("Candle:","")
                                                        dmesg_lines += line + "\n"
                                                        
                                                    if self.DEBUG:
                                                        print(line)
                                                        
                                                if "ERROR" in dmesg_lines:
                                                    self.system_update_error_detected = True        
                                                else:
                                                    self.system_update_error_detected = False
                                        
                                except Exception as ex:
                                    print("Error getting dmsg output: " + str(ex))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok',
                                                      'dmesg':dmesg_lines, 
                                                      'system_update_in_progress':self.system_update_in_progress,
                                                      'ro_exists':self.ro_exists,
                                                      'old_overlay_active':self.old_overlay_active
                                                  }),
                                )
                                
                                
                            elif action == 'files_check':
                                if self.DEBUG:
                                    print("handling files check")
                                
                                files_check_output = "An error occured"
                                try:
                                    if os.path.isfile('/home/pi/candle/files_check.sh'):
                                        files_check_output = run_command("/home/pi/candle/files_check.sh")
                                    else:
                                        files_check_output = "Not supported by this older Candle version."
                                        
                                except Exception as ex:
                                    print("Error getting files check output: " + str(ex))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok','files_check_output':files_check_output}),
                                )
                                
                                
                            elif action == 'backup_init':
                                if self.DEBUG:
                                    print("API: in backup_init")
                                
                                state = 'ok'
                                
                                self.update_backup_info()
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state,
                                                      'backup_exists':self.backup_file_exists,
                                                      'restore_exists':self.restore_file_exists, 
                                                      'disk_usage':self.disk_usage,
                                                      'photo_frame_installed':self.photo_frame_installed,
                                                      'bits':self.bits
                                                  }),
                                )
                                
                                
                            elif action == 'create_backup':
                                if self.DEBUG:
                                    print("API: in create_backup")
                                state = 'error'
                                try:
                                    
                                    if 'backup_more' in request.body:
                                        self.backup_more = bool(request.body['backup_more'])
                                    
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
                                  content=json.dumps({'state':state,
                                                      'backup_exists':self.backup_file_exists,
                                                      'restore_exists':self.restore_file_exists,
                                                      'disk_usage':self.disk_usage,
                                                      'logs_failed':self.backup_logs_failed,
                                                      'photos_failed':self.backup_photos_failed
                                                  }),
                                )
                                
                                
                            elif action == 'unlink_backup_download_dir':
                                
                                state = 'error'
                                if os.path.isdir(self.backup_download_dir):
                                    os.system('unlink ' + self.backup_download_dir) # remove symlink, so the backup files can not longer be downloaded
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
                                
                                
                                # check if power supply is strong enough (lwo voltage)
                                try:
                                    
                                    if os.path.isfile('/usr/bin/vcgencmd'):
                                        voltage_output = subprocess.check_output(['/usr/bin/vcgencmd', 'get_throttled'])
                                    else:
                                        voltage_output = subprocess.check_output(['/opt/vc/bin/vcgencmd', 'get_throttled'])
                                    
                                    voltage_output = voltage_output.decode('utf-8').split("=")[1]
                                    voltage_output = voltage_output.rstrip("\n")
                                    if self.DEBUG:
                                        print("Voltage check result: " + str(voltage_output))
                                    voltage_output
                                    if voltage_output != '0x0':
                                        
                                        if self.DEBUG:
                                            print("\nWARNING, POSSIBLE LOW VOLTAGE ISSUE DETECTED!")
                                            
                                        if (int(voltage_output,0) & 0x01) == 0x01:
                                            if self.DEBUG:
                                                print("- CURRENTLY LOW VOLTAGE")
                                            self.low_voltage = True
                                        elif (int(voltage_output,0) & 0x50000) == 0x50000:
                                            if self.DEBUG:
                                                print("- PREVIOUSLY LOW VOLTAGE")
                                            self.low_voltage = True
                                        
                                
                                except Exception as ex:
                                    print("Error checking low voltage: " + str(ex))
                                
                                
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':True, 
                                                      'total_memory':total_memory, 
                                                      'available_memory':available_memory, 
                                                      'free_memory':free_memory, 
                                                      'disk_usage':self.disk_usage, 
                                                      'low_voltage':self.low_voltage}),
                                )
                                
                            
                            
                            elif action == 'clock_page_init':
                                
                                if self.DEBUG:
                                    print("clock page init requested")
                                
                                shell_date = ""
                                try:
                                    shell_date = run_command("date")
                                except Exception as ex:
                                    print("Error getting shell date: " + str(ex))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok', 'shell_date':shell_date}),
                                )
                            
                            
                            
                            
                            # /sync_time
                            elif action == 'sync_time':
                                
                                if self.DEBUG:
                                    print("sync_time requested")
                                
                                # Place the factory reset file in the correct location so that it will be activated at boot.
                                #os.system('sudo cp ' + str(self.manual_update_script_path) + ' ' + str(self.actions_file_path))
                                os.system('sudo rm ' + str(self.hardware_clock_file_path))
                                os.system('sudo systemctl start systemd-timesyncd.service && sudo hwclock -w')
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok'}),
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
                        
                        shell_date = ""
                        if self.DEBUG:
                            print("\nin /init")
                        try:
                            now = datetime.datetime.now()
                            current_ntp_state = True
                        
                            try:
                                
                                self.check_update_processes()
                                
                                for line in run_command("timedatectl show").splitlines():
                                    if self.DEBUG:
                                        print(line)
                                    if line.startswith( 'NTP=no' ):
                                        current_ntp_state = False
                                        
                                shell_date = run_command("date")
                                        
                            except Exception as ex:
                                print("Error in /init response preparation: " + str(ex))
                            
                            response = {'hours':now.hour,
                                        'minutes':now.minute,
                                        'shell_date':shell_date,
                                        'ntp':current_ntp_state,
                                        'backup_exists':self.backup_file_exists,
                                        'restore_exists':self.restore_file_exists,
                                        'disk_usage':self.disk_usage,
                                        'allow_anonymous_mqtt':self.allow_anonymous_mqtt, 
                                        'hardware_clock_detected':self.hardware_clock_detected,
                                        'candle_version':self.candle_version,
                                        'candle_original_version':self.candle_original_version,
                                        'bootup_actions_failed':self.bootup_actions_failed,
                                        'system_update_in_progress':self.system_update_in_progress,
                                        'files_check_exists':self.files_check_exists,
                                        'live_update_attempted':self.live_update_attempted,
                                        'ro_exists':self.ro_exists,
                                        'old_overlay_active':self.old_overlay_active,
                                        'post_bootup_actions_supported':self.post_bootup_actions_supported,
                                        'update_needs_two_reboots':self.update_needs_two_reboots,
                                        'bits':self.bits,
                                        'debug':self.DEBUG
                                    }
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
                        
                        
                        
                    # Restore backup
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
                                            
                                            # clean up the non-blocking file if it exists.
                                            if os.path.isfile('/boot/bootup_actions_non_blocking.txt'):
                                                if self.DEBUG:
                                                    print("/boot/bootup_actions_non_blocking.txt still existed")
                                                os.system('rm /boot/bootup_actions_non_blocking.txt')
                                            
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
                os.system('sudo timedatectl set-ntp true') 
                if self.DEBUG:
                    print("Network time turned on")
            else:
                os.system('sudo timedatectl set-ntp false') 
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
        self.photo_frame_installed = os.path.isdir(self.photos_dir_path)
        self.disk_usage = shutil.disk_usage(directory)
        


    def backup(self):
        if self.DEBUG:
            print("in backup. self.backup_more: " + str(self.backup_more))
        
        # reset indicators
        self.backup_logs_failed = False
        self.backup_photos_failed = False
            
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
                extra_tar_commands = ""
                #log_option = ""
                #photos_option = ""
                #uploads_option = ""
                log_size = 0
                photos_size = 0
                uploads_size = 0
                if self.backup_more == True:
                    
                    # get logs file size
                    if os.path.exists(self.log_db_file_path):
                        log_size = os.path.getsize(self.log_db_file_path)
                        if self.DEBUG:
                            print("log_size: " + str(log_size))
                        
                    # calculate photos dir path
                    if os.path.isdir(self.photos_dir_path):
                        photos_size = 0
                        for path, dirs, files in os.walk(self.photos_dir_path):
                            for f in files:
                                fp = os.path.join(path, f)
                                photos_size += os.path.getsize(fp)
                        if self.DEBUG:
                            print("photos_size: " + str(photos_size))
                    else:
                        if self.DEBUG:
                            print("photos dir did not exist, photo-frame addon not installed?: " + str(self.photos_dir_path))
                            
                    # calculate uploads dir size
                    if os.path.isdir(self.uploads_dir_path):
                        for path, dirs, files in os.walk(self.uploads_dir_path):
                            for f in files:
                                fp = os.path.join(path, f)
                                uploads_size += os.path.getsize(fp)
                        if self.DEBUG:
                            print("uploads_size: " + str(uploads_size))
        
                    
                    # if logs and photos together are less than 90Mb, then all is well.
                    if log_size + photos_size + uploads_size < 90000000:
                        if log_size != 0:
                            if self.DEBUG:
                                print("adding logs to the backup command")
                            extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','log','logs.sqlite3')
                        if photos_size != 0:
                            if self.DEBUG:
                                print("adding photos to the backup command")
                            extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','data','photo-frame','photos')
                        if uploads_size != 0:
                            if self.DEBUG:
                                print("adding uploads to the backup command")
                            extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','uploads')
                        
                        
                    # if together they are too big, then prioritize the logs
                    elif log_size < 90000000 and log_size != 0:
                        if self.DEBUG:
                            print("adding big log to backup command, at the cost of photos")
                        #log_option = './log '
                        extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','log','logs.sqlite3') #'self.log_db_file_path + ' -T -'
                        self.backup_photos_failed = True
                    
                    # If the logs are too big, perhaps the photos can be backupped
                    elif photos_size < 90000000 and photos_size != 0:
                        self.backup_logs_failed = True
                        extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','addons','photo-frame','photos')
                        if self.DEBUG:
                            print("adding photos to backup command, but logs were too big")
                        
                    # if both were too big, then that's bad.
                    else:
                        self.backup_photos_failed = True
                        self.backup_logs_failed = True
                        if self.DEBUG:
                            print("Warning, both logs and photos are too big for the backup")
                    
                else:
                    if self.DEBUG:
                        print("self.backup_more was false, skipping logs, photos and uploads")
                
                backup_command = 'cd ' + str(self.user_profile['baseDir']) + '; find ./config ./data -maxdepth 2 -name "*.json" -o -name "*.yaml" -o -name "*.sqlite3" | tar -cf ' + str(self.backup_file_path) + ' -T -' 
                backup_command += extra_tar_commands
                
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
            else:
                if self.DEBUG:
                    print("\nError, could not create symlink to backup download directory. Perhaps already linked?: " + str(os.path.islink(self.backup_download_dir)))
            
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
        
        