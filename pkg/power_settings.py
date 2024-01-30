"""Power Settings API handler."""

# list read-only mounts
# grep "[[:space:]]ro[[:space:],]" /proc/mounts 

# Even simpler, this returns 'ro' or 'rw' depending on the overlay state
# cat /proc/mounts | grep /ro | awk '{print substr($4,1,2)}'

import os
import re
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import json
import time
import base64
import shutil
import datetime
import urllib.request
import functools
import subprocess

#import requests

try:
    import pyedid
    #from pyedid.edid import Edid
    #from pyedid.helpers.edid_helper import EdidHelper
    #from pyedid.helpers.registry import Registry
except Exception as ex:
    print("failed to import pyedid library: " + str(ex))


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
        
        self.addon_id = "power-settings"
        self.DEBUG = False
        self.running = True
        
        
        
        """
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
                self.addon_id = manifest['id']
        except Exception as e:
            print("ERROR, Failed load manifest.json: " + str(e))
        """
        
        try:
            APIHandler.__init__(self, self.addon_id) # manifest['id']
            self.manager_proxy.add_api_handler(self)
        except Exception as ex:
            print('Power settings: error adding api handler to manager_proxy: ' + str(ex))
        
        
        self.addon_dir = os.path.join(self.user_profile['addonsDir'], self.addon_id)
        self.data_dir = os.path.join(self.user_profile['dataDir'], self.addon_id)
        # baseDir is another useful option in user_profile

        self.display_manufacturers_csv_path = os.path.join(self.addon_dir, 'display_manufacturers.csv')
        
        self.persistence_file_path = os.path.join(self.data_dir, 'persistence.json')
        
        #print(dir(pyedid.helpers))
        
        
        # or loading from local csv file
        #self.edid_registry = pyedid.helpers.registry.from_csv(self.display_manufacturers_csv_path)
        
        
        
        
        
        
        
        # Get persistent data
        self.persistent_data = {}
        try:
            with open(self.persistence_file_path) as f:
                self.persistent_data = json.load(f)
                if self.DEBUG:
                    print('self.persistent_data loaded from file: ' + str(self.persistent_data))
        except Exception as ex:
            print("ERROR: Could not load persistent data (if you just installed the add-on then this is normal): " + str(ex))
            
        self.persistent_changed = False
        # display power management preference
        if not 'display1_power' in self.persistent_data:
            self.persistent_data['display1_power'] = False
            self.persistent_changed = True
        if not 'display2_power' in self.persistent_data:
            self.persistent_data['display2_power'] = False
            self.persistent_changed = True
            
        if self.persistent_changed:
            self.save_persistent_data()
        
        
        
        
        # MQTT
        self.allow_anonymous_mqtt = False
        self.mosquitto_conf_file_path = '/home/pi/.webthings/etc/mosquitto/mosquitto.conf'
        
        self.boot_path = '/boot'
        if os.path.exists('/boot/firmware'):
            self.boot_path = '/boot/firmware'
        
        self.config_txt_path = self.boot_path + '/config.txt'
        
        self.bits = 32
        
        try:
            bits_check = run_command('getconf LONG_BIT')
            self.bits = int(bits_check)
        except Exception as ex:
            print("error getting bits of system: " + str(ex))
        
        self.bits_extension = ""
        if self.bits == 64:
            self.bits_extension = "64"
        
        
        #self.device_model = run_command("tr -d '\0' < /proc/device-tree/model")
        self.device_model = run_command("cat /proc/device-tree/model")
        self.device_kernel = run_command("uname -r")
        self.device_linux = run_command("lsb_release -a | grep Description")
        self.device_linux = self.device_linux.replace('Description:	', '')
        
        self.device_sd_card_size = int(run_command("sudo blockdev --getsize64 /dev/mmcblk0"))
        
        

        self.recovery_partition_exists = False
        self.allow_update_via_recovery = False # will be set to True if a number of conditions are met. Allows for the new partition replace upgrade system.
        
        
        # Backup
        self.backup_more = False # May be set to true in the UI, in which case logs and photos are also backuped
        self.backup_logs_failed = False
        self.backup_photos_failed = False
        self.uploads_dir_path = os.path.join(self.user_profile['baseDir'], 'uploads')
        self.photos_dir_path = os.path.join(self.user_profile['dataDir'],'photo-frame','photos')
        self.photo_frame_installed = False
        self.photos_size = 0
        self.log_size = 0
        self.uploads_size = 0
        if os.path.isdir(self.photos_dir_path):
            self.photo_frame_installed = True
        
        
        # Ugly fix for issue with Candle 2.0.2.
        os.system('sudo chown -R pi:pi ' + str(self.user_profile['dataDir']))
            
        #print("get_hdmi_port_resolution: " + str( self.get_hdmi_port_resolution('HDMI-1') ))
            
            
        self.edid_test_hex = (
            '00ffffffffffff000469982401010101'
            '1e1b01031e351e78ea9265a655559f28'
            '0d5054bfef00714f818081409500a940'
            'b300d1c00101023a801871382d40582c'
            '4500132b2100001e000000fd00324c1e'
            '5311000a202020202020000000fc0056'
            '533234380a20202020202020000000ff'
            '0048374c4d51533132323136310a0000'
        )
        
        
        #edid = pyedid.parse_edid(edid_hex)
        

        # Bootup actions
        #self.early_actions_file_path = self.boot_path + '/bootup_actions_early.sh' # run before the gateway starts
        self.actions_file_path = self.boot_path + '/bootup_actions.sh' # run before the gateway starts
        self.post_actions_file_path = self.boot_path + '/post_bootup_actions.sh' # run 'after' the gateway starts
        self.late_sh_path = '/home/pi/candle/late.sh'
        self.system_update_error_detected = False
        
        # Factory reset
        self.keep_z2m_file_path = self.boot_path + '/keep_z2m.txt'
        self.keep_bluetooth_file_path = self.boot_path + '/keep_bluetooth.txt'
        self.factory_reset_script_path = os.path.join(self.addon_dir, "factory_reset.sh") 
        self.manual_update_script_path = os.path.join(self.addon_dir, "manual_update.sh") 
        
        self.system_update_script_path = os.path.join(self.data_dir, "create_latest_candle.sh") 
        self.live_system_update_script_path = os.path.join(self.data_dir, "live_system_update.sh") # deprecated
        
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
        self.version_file_path = self.boot_path + '/candle_version.txt'
        self.original_version_file_path = self.boot_path + '/candle_original_version.txt'
        
        # Hardware clock
        self.hardware_clock_detected = False
        self.do_not_use_hardware_clock = False
        self.hardware_clock_file_path = self.boot_path + '/candle_hardware_clock.txt'
        
        # Printers
        self.connected_printers = {}
        self.printing_allowed = True
        if os.path.exists(self.boot_path + '/candle_disable_printing.txt'):
            self.printing_allowed = False
        self.has_cups = False
        if os.path.exists('/etc/cups'):
            self.has_cups = True
        
        
        
        
        
        # Display
        self.display1_rotation = 0
        self.display2_rotation = 0
        self.rotate_display_path = self.boot_path + '/rotate180.txt'
        if os.path.exists(self.rotate_display_path):
            self.display1_rotation = 180
            self.display2_rotation = 180
        
        self.display_port1_name = None #'HDMI-1'
        self.display_port2_name = None #'HDMI-2'
        self.display1_name = 'Display 1'
        self.display2_name = 'Display 2'
        self.display1_details = ''
        self.display2_details = ''
        self.display1_available = False
        self.display2_available = False
        self.display1_width = 0
        self.display1_height = 0
        self.display2_width = 0
        self.display2_height = 0
        self.display1_power = False
        self.display2_power = False
        self.display_standby_delay = 900 # 900 seconds, 15 minutes
        
        self.edid_available = False
        self.edid_available_output = run_command('which edid-decode')
        if str(self.edid_available_output).startswith('/'):
            self.edid_available = True
        
        self.rpi_display_backlight = False
        if os.path.exists('/proc/device-tree/rpi_display_backlight'):
            self.rpi_display_backlight = True
        
        self.rpi_display_rotation = 0
        
        self.touchscreen_detected = False
        self.detect_touchscreen()
        
        
        try:
            # get HDMI port names
            display_port_names = run_command("DISPLAY=:0 xrandr | grep 'connected' | cut -d' ' -f1")
            if self.DEBUG:
                print("display_port_names: \n" + str(display_port_names))
            display_port_names = display_port_names.splitlines()
        
            if len(display_port_names) > 0:
                if len(str(display_port_names[0])) > 2:
                    self.display_port1_name = display_port_names[0]
                    [ self.display1_width, self.display1_height ] = self.get_hdmi_port_resolution(self.display_port1_name)
                    if self.DEBUG:
                        print("self.display1_width: " + str(self.display1_width))
            
                
                if len(display_port_names) > 1:
                    if len(str(display_port_names[1])) > 2:
                        self.display_port2_name = display_port_names[1]
                        [ self.display2_width, self.display2_height ] = self.get_hdmi_port_resolution(self.display_port2_name)
                        if self.DEBUG:
                            print("self.display2_width: " + str(self.display2_width))
                else:
                    self.display_port2_name = None
            else:
                self.display_port1_name = None
                self.display_port2_name = None
            
            
            self.find_display_rotation()
            
            if self.display_port1_name != None and self.persistent_data['display_resolution_' + str(self.display_port1_name)] and str(self.persistent_data['display_resolution_' + str(self.display_port1_name)]) != 'default':
                self.set_display_resolutions()
                
            elif self.display_port2_name != None and self.persistent_data['display_resolution_' + str(self.display_port2_name)] and str(self.persistent_data['display_resolution_' + str(self.display_port2_name)]) != 'default':
                self.set_display_resolutions()
            
        except Exception as ex:
            print("Error getting initial display data: " + str(ex))
            
        
        # Attached devices (USB)
        self.attached_devices = []
            
        # Attached cameras
        self.attached_cameras = []
        
        # Low voltage
        self.low_voltage = False
        
        
        # Recovery partition
        #self.recovery_not_supported = None
        self.recovery_version = 0
        self.recovery_partition_bits = 32
        self.latest_recovery_version = 2
        self.busy_updating_recovery = 0  # higher values indicate steps in the process. 5 is a likely succesfull upgrade.
        self.updating_recovery_failed = False
        self.should_start_recovery_update = False
        
        self.recovery_partition_mount_point = os.path.join(self.user_profile['dataDir'], self.addon_id,'recoverypart')
        
        if not os.path.exists(self.recovery_partition_mount_point):
            os.system('mkdir -p ' + str(self.recovery_partition_mount_point))
        
        self.just_updated_via_recovery = False
        if os.path.exists(self.boot_path + '/candle_update_via_recovery_done.txt'):
            self.just_updated_via_recovery = True
            os.system("sudo rm " + str(self.boot_path) + "/candle_update_via_recovery_done.txt")
        
        self.update_via_recovery_aborted = False
        if os.path.exists(self.boot_path + '/candle_update_via_recovery_aborted.txt'):
            self.update_via_recovery_aborted = True
            os.system("sudo rm " + str(self.boot_path) + "/candle_update_via_recovery_aborted.txt")
        
        self.update_via_recovery_interupted = False
        if os.path.exists(self.boot_path + '/candle_update_via_recovery_interupted.txt'):
            self.update_via_recovery_interupted = True
            os.system("sudo rm " + str(self.boot_path) + "/candle_update_via_recovery_interupted.txt")
        
        
        # Memory and disk space
        self.user_partition_free_disk_space = 0
        self.unused_volume_space = None
        self.total_memory = 0
        
        
        # User partition expansion
        self.user_partition_expanded = True
        self.user_partition_expansion_failed = False
        #if os.path.exists(self.boot_path + '/candle_user_partition_expanded.txt'):
        #    self.user_partition_expanded = True
        
        # System updates
        self.bootup_actions_failed = False
        self.live_update_attempted = False
        self.system_update_in_progress = False
        
        
        
        self.sd_card_written_kbytes = '?'
        
        try:
            self.user_partition_free_disk_space = int(run_command("df /home/pi/.webthings | awk 'NR==2{print $4}' | tr -d '\n'"))
            total_memory = run_command("awk '/^MemTotal:/{print $2}' /proc/meminfo | tr -d '\n'")
            self.total_memory = int( int(''.join(filter(str.isdigit, total_memory))) / 1000)
            
            # How much space is there at the end of the SD card that isn't used?
            self.unused_volume_space = int(run_command("sudo parted /dev/mmcblk0 unit B print free | grep 'Free Space' | tail -n1 | awk '{print $3}' | tr -d 'B\n'"))
            #print("unused_volume_space: " + str(self.unused_volume_space))
            
            if self.unused_volume_space > 1000000000:
                self.user_partition_expanded = False
            
            # Check total memory in system
            #total_memory = subprocess.check_output("awk '/^MemTotal:/{print $2}' /proc/meminfo", shell=True)
            #total_memory = total_memory.decode('utf-8')
            #
            
        except Exception as ex:
            print("Error getting total memory or free user partition disk space: " + str(ex))
        
        self.ro_exists = False
        if os.path.isdir('/ro'):
            self.ro_exists = True
            
        self.files_check_exists = False
        if os.path.isfile('/home/pi/candle/files_check.sh'):
            self.files_check_exists = True
            
        self.exhibit_mode = False
        if os.path.isfile(self.boot_path + '/exhibit_mode.txt'):
            self.exhibit_mode = True
        
        # LOAD CONFIG
        try:
            self.add_from_config()
        except Exception as ex:
            print("Error loading config: " + str(ex))
            
        
        if self.DEBUG:
            print("System bits: " + str(self.bits))
            print("unused volume space: " + str(self.unused_volume_space))
       
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
        if os.path.isfile(self.boot_path + '/candle_rw_once.txt'):
            os.system('sudo rm ' + str(self.boot_path) + '/candle_rw_once.txt')
            if self.DEBUG:
                print("On next reboot the controller will be read-only again")
        else:
            if self.DEBUG:
                print("no candle_rw_once.txt file spotted")
        
        if os.path.isfile(self.boot_path + '/bootup_actions.sh'):
            print("bootup_actions.sh already exists. Maybe power-settings addon was restarted after preparing an update?")
            os.system('sudo rm ' + str(self.boot_path) + '/bootup_actions.sh')
        
        if os.path.isfile(self.boot_path + '/bootup_actions_failed.sh'):
            self.bootup_actions_failed = True 
            
            # clean up the bootup_actions file regardless because it will keep running even if the file is deleted
            os.system('sudo rm ' + str(self.boot_path) + '/bootup_actions_failed.sh')
            if self.DEBUG:
                print("/boot/firmware/bootup_actions_failed.sh detected")
                
        
        if os.path.isfile(self.boot_path + '/candle_stay_rw.txt'):
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
        if not os.path.isfile(self.boot_path + '/candle_original_version.txt'):
            self.update_needs_two_reboots = True
        
        
        self.check_update_processes()
        
        self.update_backup_info()
        
        if self.DEBUG:
            print("power settings: self.user_profile: " + str(self.user_profile))
            print("self.addon_dir: " + str(self.addon_dir))
            print("self.actions_file_path: " + str(self.actions_file_path))
            print("self.manager_proxy = " + str(self.manager_proxy))
            print("Created new API HANDLER: " + str(self.addon_id))
            print("user_profile: " + str(self.user_profile))
            print("actions_file_path: " + str(self.actions_file_path))
            #print("early_actions_file_path: " + str(self.early_actions_file_path))
            print("version_file_path: " + str(self.version_file_path))
            print("original_version_file_path: " + str(self.original_version_file_path))
            print("self.backup_file_path: " + str(self.backup_file_path))
            print("self.backup_download_dir: " + str(self.backup_download_dir))
            print("self.mosquitto_conf_file_path: " + str(self.mosquitto_conf_file_path))
                
        
        
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


            if os.path.isfile(self.boot_path + '/cmdline.txt'):
                with open(self.boot_path + '/cmdline.txt') as f:
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
            if self.DEBUG:
                print("Error getting Candle versions: " + str(ex))
        
        # Connected via ethernet?
        self.ethernet_connected = False
        self.check_ethernet_connected()
        
        # get backup context, such as disk size
        self.update_backup_info()
        
        # get recovery partition version
        self.check_recovery_partition()
        
        
        
        # Check if anonymous MQTT access is currently allowed
        try:
            with open(self.mosquitto_conf_file_path) as file:

               df = file.read()
               if self.DEBUG:
                   print("mosquitto_conf: " + str(df))
               
               if 'allow_anonymous true' in df:
                   self.allow_anonymous_mqtt = True
                   
        except Exception as ex:
            if self.DEBUG:
                print("Error reading MQTT config file: " + str(ex))
           
        if self.DEBUG:
            print("self.allow_anonymous_mqtt: " + str(self.allow_anonymous_mqtt))
        
        
        self.detect_printers()
        
        
        while self.running:
            time.sleep(2)
            if self.should_start_recovery_update == True:
                if self.DEBUG:
                    print("should_start_recovery_update was True. Calling update_recovery_partition")
                self.should_start_recovery_update = False
                self.update_recovery_partition()
        
        
        
    # Read the settings from the add-on settings page
    def add_from_config(self):
        """Attempt to add all configured devices."""
        try:
            database = Database(self.addon_id)
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

        if 'Display standby delay' in config:
            self.display_standby_delay = int(config['Display standby delay']) * 60
            if self.DEBUG:
                print("-Display standby delay preference was in config: " + str(self.display_standby_delay))
        
                
                
    def detect_touchscreen(self):
        touch_test = run_command("udevadm info -q all -n /dev/input/event* | grep 'ID_INPUT_TOUCHSCREEN=1'")
        if touch_test == None:
            self.touchscreen_detected = False
            return False
        elif 'E: ID_INPUT_TOUCHSCREEN=1' in touch_test:
            self.touchscreen_detected = True
            return True
        else:
            self.touchscreen_detected = False
            return False
        
    
        
    def set_display_resolutions(self):
        if self.DEBUG:
            print("in set_display_resolutions")
        
        if self.display_port1_name:
            [ self.display1_width, self.display1_height ] = self.get_hdmi_port_resolution(self.display_port1_name)
            if self.DEBUG:
                print("self.display1_width: " + str(self.display1_width))

            if 'display_resolution_' + str(self.display_port1_name) in self.persistent_data:
                reso1 = str(self.persistent_data['display_resolution_' + str(self.display_port1_name)])
                if str(self.display1_width) + 'x' + str(self.display1_height) != reso1:
                    if self.DEBUG:
                        print("setting display port1: "  + str(self.display_port1_name) + ", to: " + reso1)
                    if reso1 == 'default':
                        os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port1_name) + ' --auto')
                    else:
                        os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port1_name) + ' --mode ' + str(reso1) + ' --rate 60')
                
        
        if self.display_port2_name:
            [ self.display2_width, self.display2_height ] = self.get_hdmi_port_resolution(self.display_port2_name)
            if self.DEBUG:
                print("self.display1_width: " + str(self.display2_width))

            if 'display_resolution_' + str(self.display_port2_name) in self.persistent_data:
                reso2 = str(self.persistent_data['display_resolution_' + str(self.display_port2_name)])
                if str(self.display2_width) + 'x' + str(self.display2_height) != reso1:
                    if self.DEBUG:
                        print("setting display port2: "  + str(self.display_port2_name) + ", to: " + reso2)
                    if reso2 == 'default':
                        os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port2_name) + ' --auto')
                    else:
                        os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port2_name) + ' --mode ' + str(reso2) + ' --rate 60')
            
            
            
    def find_display_rotation(self):
        # Get rotation
        if self.display_port1_name:
            display1_rotation_output = run_command("DISPLAY=:0 xrandr --query --verbose | grep '" + str(self.display_port1_name) + "' | cut -d ' ' -f 6")
            if display1_rotation_output:
                self.display1_rotation = 0
                if 'left' in display1_rotation_output:
                    self.display1_rotation = 90 # NOT SURE IF THIS IS RIGHT
                elif 'right' in display1_rotation_output:
                    self.display1_rotation = 270 # NOT SURE IF THIS IS RIGHT
                if 'inverted' in display1_rotation_output:
                    self.display1_rotation = 180
                
        if self.display_port1_name:
            display2_rotation_output = run_command("DISPLAY=:0 xrandr --query --verbose | grep '" + str(self.display_port2_name) + "' | cut -d ' ' -f 6")
            if display2_rotation_output:
                self.display2_rotation = 0
                if 'left' in display2_rotation_output:
                    self.display2_rotation = 90 # NOT SURE IF THIS IS RIGHT
                elif 'right' in display2_rotation_output:
                    self.display2_rotation = 270 # NOT SURE IF THIS IS RIGHT
                if 'inverted' in display2_rotation_output:
                    self.display2_rotation = 180
            
    
    
    def set_display_rotation(self,display=None,rotation=0):
        if self.DEBUG:
            print("in set_display_rotation. Desired rotation: ", rotation);
        
        
        # Display rotation
        if int(rotation) == 0:
            os.system('sudo rm ' + str(self.rotate_display_path))
            if self.display1_width != 0:
                os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port1_name) + ' --rotate normal')
            
            if self.display2_width != 0:
                os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port2_name) + ' --rotate normal')
            
        elif int(rotation) == 180:
            os.system('sudo touch ' + str(self.rotate_display_path))
            if self.display1_width != 0:
                os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port1_name) + ' --rotate inverted')
            if self.display2_width != 0:
                os.system('DISPLAY=:0 xrandr --output ' + str(self.display_port2_name) + ' --rotate inverted')
            
            
        # Touch input rotation
        pointer_output = run_command("DISPLAY=:0 xinput | grep pointer | tail -n +2 | grep -v ' XTEST '") #  | cut -f1 -d$'\t'     # | grep -v ' XTEST '
        if pointer_output != None:
            for line in pointer_output.splitlines():
                print("pointer_output line: " + str(line))
                
                input_name = re.split(r'\t+', line)[0]
                print("input_name again: " + str(input_name))
                
                input_name = input_name[5:].strip()
                
                print("input_name again2: " + str(input_name))
                print("int(rotation): " + str(int(rotation)))
                
                if int(rotation) == 0:
                    os.system("DISPLAY=:0 xinput --set-prop '" + str(input_name) + "' 'Coordinate Transformation Matrix' 1 0 0 0 1 0 0 0 1")
                else:
                    os.system("DISPLAY=:0 xinput --set-prop '" + str(input_name) + "' 'Coordinate Transformation Matrix' -1 0 1 0 -1 1 0 0 1")
            
             
            
    def get_hdmi_port_resolution(self, hdmi_port_name=''):
        if self.DEBUG:
            print("in get_hdmi_port_resolution. hdmi_port_name: " + str(hdmi_port_name))
        try:
            if len(str(hdmi_port_name)) > 2:
                connected_check = run_command('DISPLAY=:0 xrandr | grep " connected" | grep ' + str(hdmi_port_name))
                if self.DEBUG:
                    print("connected_check: " + str(connected_check))
                if connected_check != None and len(str(connected_check)) > 5 and '+' in str(connected_check):
                    #connected_check = connected_check[connected_check.find(' connected'):]
                    connected_check = connected_check[:connected_check.find('+')]
                    connected_check = connected_check.split(' ')[-1]
                    connected_check = connected_check.strip()
                    if self.DEBUG:
                        print("stripped connected_check: " + str(connected_check))
                    if 'x' in connected_check:
                        connected_check_parts = connected_check.split('x')
                        if connected_check_parts[0] == str(int(connected_check_parts[0])) and connected_check_parts[1] == str(int(connected_check_parts[1])):
                            if self.DEBUG:
                                print("resolution: " + str(connected_check_parts))
                            return connected_check_parts
        except Exception as ex:
            print("Error in in get_hdmi_port_resolution: " + str(ex))
        
        if self.DEBUG:
            print("get_hdmi_port_resolution: failed to extract resolution. hdmi_port_name: " + str(hdmi_port_name))
        return [0,0]
        
        
        
    def check_update_processes(self):
        check_bootup_actions_running = run_command("sudo ps aux | grep bootup_action")
        if self.DEBUG:
            print("checking for bootup_actions in ps aux output: " + str(check_bootup_actions_running))
        if os.path.exists(self.boot_path + '/bootup_actions_failed.sh'):
            if self.boot_path + "/bootup_actions" in check_bootup_actions_running:
                if self.DEBUG:
                    print("BOOTUP ACTIONS SEEMS TO BE RUNNING!")
                self.system_update_in_progress = True
            elif self.boot_path + "/post_bootup_actions" in check_bootup_actions_running:
                if self.DEBUG:
                    print("POST BOOTUP ACTIONS SEEMS TO BE RUNNING!")
                self.system_update_in_progress = True
            else:
                self.system_update_in_progress = False
        else:
            self.system_update_in_progress = False
        
        if self.DEBUG:
            if self.system_update_in_progress == False:
                print("no system update in progress")
        
        
        
    # Check if an i2c hardware clock module is installed
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
        
        
        
    def check_ethernet_connected(self):
        try:
            ethernet_state = run_command('cat /sys/class/net/eth0/operstate')
            if self.DEBUG:
                print("ethernet_state: " + str(ethernet_state))
            cable_needed = False
            if 'down' in ethernet_state:
                if self.DEBUG:
                    print("No ethernet cable connected")
                cable_needed = True
            else:
                if self.DEBUG:
                    print("Ethernet cable seems connected")
            self.ethernet_connected = not cable_needed
        except Exception as ex:
            print("Error in check_ethernet_connection: " + str(ex))



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
                                
                                
                            # GET DISPLAY INFO
                                
                            elif action == 'display_init':
                                state = 'error'
                                
                                self.display1_available = False
                                self.display2_available = False
                                self.display1_power = False
                                self.display2_power = False
                                self.display1_details = ''
                                self.display2_details = ''
                                self.display1_name = 'Display 1'
                                self.display2_name = 'Display 1'
                                self.display_port1_name = ''
                                self.display_port2_name = ''
                                
                                
                                # find /sys/devices -name "edid"
                                
                                try:
                                    #fbset_output = run_command('fbset')
                                    #if self.DEBUG:
                                    #    print("fbset output: " + str(fbset_output))
                                
                                    """
                                    if "No such file or directory" not in fbset_output:
                                        xrandr_output = run_command('DISPLAY=:0 xrandr')
                                        if ' connected primary (' in xrandr_output:
                                            self.display1_available = True
                                    
                                            if ' connected (' in xrandr_output:
                                                self.display2_available = True
                                    
                                        elif 'disconnected primary (' in xrandr_output and ' connected (' in xrandr_output:
                                            self.display2_available = True
                                
                                    
                                        # fbset is nice and backwards compatible with older versions of Candle
                                        fbset_output = run_command('fbset | grep \'mode "\'')
                                        if self.DEBUG:
                                            print("fbset_output: " + str(fbset_output))
        
                                        if 'mode "' in fbset_output and 'x' in fbset_output:
                                            if self.DEBUG:
                                                print("possibly display detected")
                                            #self.display1_available = True
            
                                            fbset_output = fbset_output.replace('mode "','')
                                            fbset_output = fbset_output.replace('"','')
                                            fbset_output_array = fbset_output.split('x')
                                            if len(fbset_output_array) == 2:
                                                self.display1_width = fbset_output_array[0]
                                                self.display1_height = fbset_output_array[1]
                                            if self.DEBUG:
                                                print("display1_width, display1_height: ", self.display1_width, self.display1_height)
                                
                                    """
                                
                                
                                
                                
                                    # get HDMI port names
                                    display_port_names = run_command("DISPLAY=:0 xrandr | grep 'connected' | cut -d' ' -f1")
                                    if self.DEBUG:
                                        print("display_port_names: \n" + str(display_port_names))
                                    display_port_names = display_port_names.splitlines()
                                
                                    if len(display_port_names) > 0:
                                        if len(str(display_port_names[0])) > 2:
                                            self.display_port1_name = str(display_port_names[0])
                                            [ self.display1_width, self.display1_height ] = self.get_hdmi_port_resolution(self.display_port1_name)
                                            if self.DEBUG:
                                                print("self.display1_width: " + str(self.display1_width))
                                        
                                    if len(display_port_names) > 1:
                                        if len(str(display_port_names[1])) > 2:
                                            self.display_port2_name = str(display_port_names[1])
                                            [ self.display2_width, self.display2_height ] = self.get_hdmi_port_resolution(self.display_port2_name)
                                            if self.DEBUG:
                                                print("self.display2_width: " + str(self.display2_width))
                                                
                                    
                                    connected_port_names = run_command("DISPLAY=:0 xrandr | grep ' connected'")
                                    for connected_port in connected_port_names.splitlines():
                                        if connected_port == self.display_port1_name:
                                            self.display1_available = True
                                        if connected_port == self.display_port2_name:
                                            self.display2_available = True
                                
                                    #subprocess.check_output
                                    edids = pyedid.get_edid_from_xrandr_verbose(run_command("DISPLAY=:0 xrandr --verbose"))
                                    if self.DEBUG:
                                        print("edids 1: " + str(edids))
                                    
                                    for x, edid in enumerate(edids):
                                        if self.DEBUG:
                                            print(x, pyedid.parse_edid(edid))
                                        if x == 0:
                                            self.display1_details = str(pyedid.parse_edid(edid));
                                        if x == 1:
                                            self.display2_details = str(pyedid.parse_edid(edid));
                                
                                
                                    """
                                    for x in range(len(edids)):
                                    for x in range(len(edids)-1):
                                        print("x: " + str(x))
                                        edid = pyedid.parse_edid(edids[x])
                                    
                                    
                                    #if len(edids) == 1:
                                
                                
                                
                                
                                    #if self.DEBUG:
                                    #    print("\nparsed edid: " + str(edid))
                                
                                    edid_paths = run_command('find -L /sys/class/drm -maxdepth 2 | grep edid | grep -v riteback')
                                    edid_paths = edid_paths.splitlines()
                                
                                
                                    for x in range(len(edid_paths)-1):
                                        if self.DEBUG:
                                            print("checking edid #: " + str(x) + " -> " + str(edid_paths[x]))
                                        
                                        with open(edid_paths[x], 'rb') as f:
                                            edid_data = f.read().hex()
                                            print(str(edid_data))
                                            # loading list with edid data
                                            #edid_bs = EdidHelper.get_edids()[0]

                                            # convert exist edid hex string from xrandr
                                            #edid_bs = EdidHelper.hex2bytes("hex string from xrandr...")

                                            #### Step 3: create instance

                                            # create Edid instance for fisrt edid data
                                            #edid = Edid(edid_data, self.edid_registry)
                                            #print(".\nedid: " + str(edid))
                                    """
                                
                                    """
                                    # get display name from EDID data
                                    if self.edid_available:
                                        edid_paths = run_command('find -L /sys/class/drm -maxdepth 2 | grep edid | grep -v riteback')
                                        edid_paths = edid_paths.splitlines()
                                    
                                        for x in range(len(edid_paths)-1):
                                            if self.DEBUG:
                                                print("checking edid #: " + str(x))
                                            edid_data = run_command("edid-decode " + str(edid_paths[x]))
                                            if self.DEBUG:
                                                print("edid_data: " + str(edid_data))
                                            if 'edid-decode (hex):' in edid_data:
                                                manufacturer = None
                                                display_name = ""
                                                for line in edid_data.split('\n'):
                                                    if 'Manufacturer:' in line:
                                                        manufacturer = line.replace('Manufacturer:','').strip()
                                                    if 'Display Product Name:' in line:
                                                        line = line.replace('Display Product Name:','').strip()
                                                        display_name = line + ' ' + display_name
                                                    if 'Model:' in line:
                                                        line = line.replace('Model:','').strip()
                                                        display_name = display_name + ' ' + line
                                            
                                                if manufacturer != None:
                                                    display_name = manufacturer + ' ' + display_name
                                            
                                                # TODO: should have a better, mmore flexible datastructure for display data..
                                                if x == 0:
                                                    self.display1_details = edid_data
                                                    if len(str(display_name)) > 3:
                                                        self.display1_name = display_name
                                                if x == 1:
                                                    self.display2_details = edid_data
                                                    if len(str(display_name)) > 3:
                                                        self.display2_name = display_name
                                        
                                        
                                    
                                    """
                                
                                    # DISPLAY=:0 xrandr | grep ' connected' | cut -d' ' -f1
                                    
                                
                                    # Power management
                                    display1_power_management_output = run_command("DISPLAY=:0 xset -q | awk '/DPMS is/ {print $NF}'")
                                    if 'unable to open' in display1_power_management_output:
                                        #self.display1_available = False
                                        pass
                                    elif 'Disabled' in display1_power_management_output:
                                        self.display1_power = False
                                        self.display2_power = False
                                    else:
                                        self.display1_power = True
                                        self.display2_power = True
                                
                                    
                                    self.detect_touchscreen()
                                
                                    self.find_display_rotation()
                                    
                                
                                    state = 'ok'
                                except Exception as ex:
                                    print("Error getting display info: " + str(ex))
                                    
                                
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state,
                                          'display_port1_name':self.display_port1_name,
                                          'display_port2_name':self.display_port2_name,
                                          'display1_available':self.display1_available,
                                          'display2_available':self.display2_available,
                                          'display1_name':self.display1_name,
                                          'display2_name':self.display2_name,
                                          'display1_details':self.display1_details,
                                          'display2_details':self.display2_details,
                                          'display1_rotated':self.display1_rotation,
                                          'display2_rotated':self.display2_rotation,
                                          'display1_width':self.display1_width,
                                          'display1_height':self.display1_height,
                                          'display2_width':self.display2_width,
                                          'display2_height':self.display2_height,
                                          'display1_power':self.display1_power,
                                          'display2_power':self.display2_power,
                                          'display_standby_delay':self.display_standby_delay,
                                          'rpi_display_backlight':self.rpi_display_backlight,
                                          'rpi_display_rotation':self.rpi_display_rotation,
                                          'touchscreen_detected':self.touchscreen_detected
                                          }),
                                )
                                
                                
                            # DISPLAY ROTATION
                            elif action == 'set_display_rotation':
                                state = 'error'
                                if 'display1_rotation' in request.body and 'display2_rotation' in request.body:
                                    self.display1_rotation = int(request.body['display1_rotation'])
                                    self.display2_rotation = int(request.body['display2_rotation'])
                                    if self.DEBUG:
                                        print("new display1 rotation: " + str(self.display1_rotation))
                                        print("new display2 rotation: " + str(self.display2_rotation))
                                    
                                    
                                    state = 'ok'
                                    if self.display1_width != 0:
                                        self.set_display_rotation(None,self.display1_rotation)
                                        
                                    if self.display2_width != 0:
                                        self.set_display_rotation(None,self.display2_rotation)
                                        
                                        
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                                
                            
                            
                            # DISPLAY ROTATION
                            elif action == 'set_rpi_display_rotation':
                                state = 'error'
                                if 'rpi_display_rotation' in request.body:
                                    self.rpi_display_rotation = int(request.body['rpi_display_rotation'])
                                    
                                    
                                    if self.DEBUG:
                                        print("new Rpi Display rotation: " + str(self.rpi_display_rotation))
                                    
                                    state = 'ok'
                                    
                                    if self.rpi_display_rotation == 0:
                                        os.system('sudo rm ' + str(self.rotate_display_path))
                                    else:
                                        os.system('sudo touch ' + str(self.rotate_display_path))
                                        
                                    # TODO: make changes to rotate official Rpi Display
                                    
                                    
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                                
                                
                                
                            
                            # DISPLAY POWER MANAGEMENT
                            elif action == 'set_display_power':
                                state = 'error'
                                try:
                                    if 'display1_power' in request.body and 'display2_power' in request.body:
                                    
                                        self.persistent_data['display1_power'] = bool(request.body['display1_power'])
                                        self.persistent_data['display2_power'] = bool(request.body['display2_power'])
                                        
                                        if self.DEBUG:
                                            print("new display1 power management: " + str(self.persistent_data['display1_power']))
                                            print("new display2 power management: " + str(self.persistent_data['display2_power']))
                                    
                                        if self.persistent_data['display1_power'] == True or self.persistent_data['display2_power'] == True:
                                            # allow the screen to go into standby
                                            os.system('DISPLAY=:0 xset s on')
                                            os.system('DISPLAY=:0 xset dpms')
                                            os.system('DISPLAY=:0 xset s blank')
                                            os.system('DISPLAY=:0 xset dpms ' + str(self.display_standby_delay) + ' 0 0')
                                        else:
                                            # stay on
                                            os.system('DISPLAY=:0 xset s off')
                                            os.system('DISPLAY=:0 xset -dpms')
                                            os.system('DISPLAY=:0 xset s noblank')
                                            os.system('DISPLAY=:0 xset dpms 0 0 0')
                                            
                                        """
                                        if self.persistent_data['display2_power'] == True:
                                            # allow the screen to go into standby
                                            os.system('DISPLAY=:1 xset s on')
                                            os.system('DISPLAY=:1 xset dpms')
                                            os.system('DISPLAY=:1 xset s blank')
                                            os.system('DISPLAY=:1 xset dpms ' + str(self.display_standby_delay) + ' 0 0')
                                        else:
                                            # stay on
                                            os.system('DISPLAY=:1 xset s off')
                                            os.system('DISPLAY=:1 xset -dpms')
                                            os.system('DISPLAY=:1 xset s noblank')
                                            os.system('DISPLAY=:1 xset dpms 0 0 0')
                                        """
                                            
                                        if self.save_persistent_data():
                                            state = 'ok'
                                
                                except Exception as ex:
                                    print("Error saving/setting display power management preferences")
                                        
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                                
                                
                            # DISPLAY POWER MANAGEMENT
                            elif action == 'set_display_resolution':
                                state = 'error'
                                try:
                                    if 'port' in request.body and 'resolution' in request.body:
                                    
                                        self.persistent_data['display_resolution_' + str(request.body['port'])] = str(request.body['resolution'])
                                        if self.save_persistent_data():
                                            state = 'ok'
                                
                                        self.set_display_resolutions()
                                
                                except Exception as ex:
                                    print("Error saving/setting display power management preferences")
                                        
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                                
                                
                            
                            elif action == 'force_display_setting':
                                state = 'error'
                                if 'width' in request.body and 'height' in request.body:
                                    intended_width = int(request.body['width'])
                                    intended_height = int(request.body['height'])
                                    if self.DEBUG:
                                        print("forcing display: " + str(intended_width) + "x" + str(intended_height))
                                    state = 'ok'
                                    
                                    if not "#candle_force_display" in self.config_txt:
                                        self.config_txt += "\n#candle_force_display_start\n#candle_force_display_end"
                                    
                                    new_display_settings = ""
                                    
                                    
                                    self.config_txt_lines = self.config_txt.splitlines()
                                    if "#candle_force_display_start" in self.config_txt_lines:
                                        for line in self.config_txt_lines:
                                            if line.startswith('#'):
                                                continue
                                            if len(line) == 0:
                                                continue
                                        
                                    
                                    # official raspberry pi touch screen: rpi-ft5406
                                    
                                    # backlight driver for official display:
                                    # dtoverlay=rpi-backlight
                                    
                                    """
                                    Name:   rpi-ft5406
                                    Info:   Official Raspberry Pi display touchscreen
                                    Load:   dtoverlay=rpi-ft5406,<param>=<val>
                                    Params: touchscreen-size-x      Touchscreen X resolution (default 800)
                                            touchscreen-size-y      Touchscreen Y resolution (default 600);
                                            touchscreen-inverted-x  Invert touchscreen X coordinates (default 0);
                                            touchscreen-inverted-y  Invert touchscreen Y coordinates (default 0);
                                            touchscreen-swapped-x-y Swap X and Y cordinates (default 0);
                                    
                                    """
                                        
                                        
                                    if new_display_settings != "":
                                        re.sub('#candle_force_display_start.*?#candle_force_display_end',new_display_settings,self.config_txt, flags=re.DOTALL)
                                    
                                        print("self.config_txt is now: \n\n" + str(self.config_txt) + "\n\n")
                                        
                                        
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                            
                            
                            
                            elif action == 'printer':
                                
                                if 'printing_allowed' in request.body:
                                    self.printing_allowed = bool(request.body['printing_allowed'])
                                    if self.DEBUG:
                                        print("printing_allowed changed to: " + str(self.printing_allowed))
                                    if self.printing_allowed == True:
                                        os.system('sudo rm ' + self.boot_path + '/candle_disable_printing.txt')
                                    else:
                                        os.system('sudo touch ' + self.boot_path + '/candle_disable_printing.txt')
                                        for printer_id in self.connected_printers:
                                            os.system("sudo lpadmin -x " + str(printer_id))
                                        
                                if 'default_printer' in request.body:
                                    if self.DEBUG:
                                        print("Changing default printer to: " + str(request.body['default_printer']))
                                    self.persistent_data['default_printer'] = str(request.body['default_printer'])
                                    
                                self.detect_printers()
                        
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':True, 
                                                      'connected_printers':self.connected_printers,
                                                      'printing_allowed':self.printing_allowed
                                                  }),
                                )
                            
                            
                            # Test speakers
                            elif action == 'test_speakers':
                                self.test_speakers()
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok'}),
                                )
                                
                            # Reinstall candle app store from Github
                            elif action == 'reinstall_app_store':
                                state = self.reinstall_app_store()
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                                
                            
                            
                            # UPDATE RECOVERY PARTITION
                            elif action == 'update_recovery_partition':
                                
                                if self.DEBUG:
                                    print("start of update_recovery_partition requested")
                                
                                self.busy_updating_recovery = 0
                                self.should_start_recovery_update = True
                                #self.system_update_in_progress = True
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok'}),
                                )
                            
                                
                                
                                
                            # EXPAND USER PARTITION
                            elif action == 'expand_user_partition':
                                
                                if self.DEBUG:
                                    print("request to expand_user_partition")
                                
                                state = self.expand_user_partition()
                                
                                # because this reboots the system this will likely not be called
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({
                                          'state':state,
                                          'user_partition_expansion_failed': self.user_partition_expansion_failed,
                                      }),
                                )
                                
                                
                            # MANUAL UPDATE
                            elif action == 'manual_update':
                                
                                if self.DEBUG:
                                    print("copying manual update script into position")
                                
                                # Place the factory reset file in the correct location so that it will be activated at boot.
                                #os.system('sudo cp ' + str(self.manual_update_script_path) + ' ' + str(self.actions_file_path))
                                os.system('sudo touch ' + str(self.boot_path) + '/candle_rw_once.txt')
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
                                        os.system('sudo touch ' + str(self.boot_path) + '/candle_rw_once.txt')
                                        if not os.path.isfile(self.boot_path + '/candle_rw_once.txt'):
                                            state = False
                                            
                                    if self.old_overlay_active:
                                        if self.DEBUG:
                                            print("disabling old raspi-config overlay system")
                                        os.system('sudo raspi-config nonint disable_bootro')
                                        os.system('sudo raspi-config nonint disable_overlayfs')
                                
                                    if os.path.isfile(self.boot_path + '/cmdline.txt'):
                                        with open(self.boot_path + '/cmdline.txt') as f:
                                            #self.candle_version = f.readlines()
                                            cmdline = f.read()
                                            if "boot=overlay" in cmdline:
                                                if self.DEBUG:
                                                    print("Error, old overlay still active")
                                                state == False
                                            else:
                                                if self.DEBUG:
                                                    print("Old overlay is gone from cmdline.txt")
                                        
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
                                
                                
                                
                            # OLD SCHOOL SYSTEM UPDATE 
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
                                            os.system('sudo touch ' + str(self.boot_path) + '/candle_cutting_edge.txt')
                                            if self.DEBUG:
                                                print("created /boot/firmware/candle_cutting_edge.txt file")
                                        else:
                                            if os.path.isfile(self.boot_path + '/candle_cutting_edge.txt'):
                                                os.system('sudo rm ' + str(self.boot_path) + '/candle_cutting_edge.txt')
                                                if self.DEBUG:
                                                    print("removed candle_cutting_edge.txt file from boot partition")
                                
                                
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
                                            
                                            if os.path.isfile(self.boot_path + '/candle_cutting_edge.txt'):
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
                                                        
                                                        os.system('sudo touch ' + str(self.boot_path) + '/candle_rw_once.txt')
                                                        
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
                                        
                                        self.check_update_processes()
                                        
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
                                                        
                                                    #if self.DEBUG:
                                                    #    print(line)
                                                        
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
                                                      'old_overlay_active':self.old_overlay_active,
                                                      'user_partition_expansion_failed': self.user_partition_expansion_failed,
                                                  }),
                                )
                                
                                
                            # used while updating the recovery partition and installing a system update via the recovery partition
                            elif action == 'recovery_poll':
                                if self.DEBUG:
                                    print("handling recovery_poll action. self.busy_updating_recovery: " + str(self.busy_updating_recovery))
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':'ok',
                                                      'busy_updating_recovery':self.busy_updating_recovery,
                                                      'updating_recovery_failed':self.updating_recovery_failed,
                                                      'allow_update_via_recovery':self.allow_update_via_recovery
                                                  }),
                                )
                                
                                
                                
                            # Switch to recovery partition
                            elif action == 'switch_to_recovery':
                                if self.DEBUG:
                                    print("handling switch_to_recovery action")
                                
                                state = self.switch_to_recovery()
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state}),
                                )
                                
                                
                            
                            # Check if any Candle system files are missing
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
                                
                            
                            
                            # Called when the user opens the update page
                            elif action == 'update_init':
                                if self.DEBUG:
                                    print("API: in update_init")
                                
                                state = 'ok'
                                
                                self.check_ethernet_connected()
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':state,
                                                      'bits':self.bits,
                                                      
                                                      'candle_version':self.candle_version,
                                                      'candle_original_version':self.candle_original_version,
                                                      
                                                      'bootup_actions_failed':self.bootup_actions_failed,
                                                      'files_check_exists':self.files_check_exists,
                                                      'ro_exists':self.ro_exists,
                                                      'old_overlay_active':self.old_overlay_active,
                                                      'post_bootup_actions_supported':self.post_bootup_actions_supported,
                                                      'update_needs_two_reboots':self.update_needs_two_reboots,
                                                      
                                                      'recovery_partition_exists':self.recovery_partition_exists,
                                                      'recovery_version':self.recovery_version,
                                                      'latest_recovery_version':self.latest_recovery_version,
                                                      'allow_update_via_recovery':self.allow_update_via_recovery,
                                                      'busy_updating_recovery':self.busy_updating_recovery,
                                                      'ethernet_connected':self.ethernet_connected,
                                                      'updating_recovery_failed':self.updating_recovery_failed,
                                                      
                                                      'system_update_in_progress':self.system_update_in_progress,
                                                      'user_partition_free_disk_space':self.user_partition_free_disk_space,
                                                      'total_memory': self.total_memory
                                                  }),
                                )
                            
                            
                            
                            # Called when the user opens the backup page
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
                                                      'log_size':int(self.log_size),
                                                      'photos_size':int(self.photos_size),
                                                      'uploads_size':int(self.uploads_size),
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
                                
                                self.attached_devices = []
                                free_memory = '?'
                                try:
                                    
                                    # written kbytes to sd card
                                    #self.sd_card_written_kbytes = int(run_command("cat /sys/fs/ext4/mmcblk0p4/lifetime_write_kbytes"))
                                    self.sd_card_written_kbytes = run_command('sudo dumpe2fs /dev/mmcblk0p4 | grep "Lifetime writes:"')
                                    self.sd_card_written_kbytes = self.sd_card_written_kbytes.replace('Lifetime writes:','')
                                    self.sd_card_written_kbytes = self.sd_card_written_kbytes.strip()
                                    
                                    if self.DEBUG:
                                        print("debug: sd_card_written_kbytes: " + str(self.sd_card_written_kbytes))
                                        
                                    # check free memory
                                    free_memory = subprocess.check_output(['grep','^MemFree','/proc/meminfo'])
                                    free_memory = free_memory.decode('utf-8')
                                    free_memory = int( int(''.join(filter(str.isdigit, free_memory))) / 1000)
                                    if self.DEBUG:
                                        print("debug: free_memory: " + str(free_memory))
                                    
                                    # Check available memory
                                    available_memory = subprocess.check_output("free | grep Mem:", shell=True)
                                    available_memory = available_memory.decode('utf-8')
                                    available_memory_parts = available_memory.split()
                                    available_memory = available_memory_parts[-1]
                                    available_memory = int( int(''.join(filter(str.isdigit, available_memory))) / 1000)
                                    if self.DEBUG:
                                        print("debug: available_memory: " + str(available_memory))
                                    
                                    if self.DEBUG:
                                        print("debug: total_memory: " + str(self.total_memory))
                                    
                                    self.update_backup_info()
                                    
                                except Exception as ex:
                                    print("Error checking free memory: " + str(ex))
                                
                                # check if power supply is strong enough (lwo voltage)
                                try:
                                    board_temperature = None
                                    if os.path.isfile('/usr/bin/vcgencmd'):
                                        voltage_output = subprocess.check_output(['/usr/bin/vcgencmd', 'get_throttled'])
                                        board_temperature = subprocess.check_output(['/usr/bin/vcgencmd', 'measure_temp'])
                                        board_temperature = board_temperature.decode('utf-8').split("=")[1]
                                        board_temperature = board_temperature.rstrip("\n")
                                    else:
                                        voltage_output = subprocess.check_output(['/opt/vc/bin/vcgencmd', 'get_throttled'])
                                    
                                    voltage_output = voltage_output.decode('utf-8').split("=")[1]
                                    voltage_output = voltage_output.rstrip("\n")
                                    if self.DEBUG:
                                        print("debug: voltage check result: " + str(voltage_output))
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
                                
                                
                                try:
                                    self.attached_devices = []
                                    lsusb_output = run_command("lsusb | cut -d' ' -f 7,8,9,10,11,12,13,14,15")
                                    if self.DEBUG:
                                        print("debug: lsusb output: " + str(lsusb_output))
                                    
                                    if lsusb_output  != None:
                                        self.attached_devices = lsusb_output.splitlines()
                                    
                                    
                                    self.attached_cameras = []
                                    libcamera_output = run_command('libcamera-still --list-cameras')
                                    if 'No cameras available' in libcamera_output or 'error while loading' in libcamera_output:
                                        if self.DEBUG:
                                            print("debug: no libcameras detected")
                                    else:
                                        if self.DEBUG:
                                            print("libcamera(s) detected: " + str(libcamera_output))
                                        self.attached_cameras = ['camera']
                                        
                                except Exception as ex:
                                    print("Error while checking for attached (USB) devices: " + str(ex))
                                
                                self.check_ethernet_connected()
                                
                                
                                return APIResponse(
                                  status=200,
                                  content_type='application/json',
                                  content=json.dumps({'state':True, 
                                                      'total_memory':self.total_memory, 
                                                      'available_memory':available_memory, 
                                                      'free_memory':free_memory, 
                                                      'disk_usage':self.disk_usage,
                                                      'sd_card_written_kbytes':self.sd_card_written_kbytes,
                                                      'low_voltage':self.low_voltage,
                                                      'board_temperature':board_temperature,
                                                      'attached_devices':self.attached_devices,
                                                      'ethernet_connected':self.ethernet_connected,
                                                      'has_cups':self.has_cups,
                                                      'printing_allowed':self.printing_allowed,
                                                      'connected_printers':self.connected_printers,
                                                      'attached_cameras':self.attached_cameras,
                                                      'user_partition_expanded': self.user_partition_expanded,
                                                      'user_partition_expansion_failed': self.user_partition_expansion_failed
                                            })
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
                                self.update_backup_info()
                                
                                for line in run_command("timedatectl show").splitlines():
                                    if self.DEBUG:
                                        print(line)
                                    if line.startswith( 'NTP=no' ):
                                        current_ntp_state = False
                                        
                                shell_date = run_command("date")
                                        
                                #just_updated_via_recovery = self.just_updated_via_recovery
                                #self.just_updated_via_recovery = False
                                
                                local_update_via_recovery_aborted = self.update_via_recovery_aborted
                                self.update_via_recovery_aborted = False
                                
                                local_update_via_recovery_interupted = self.update_via_recovery_interupted
                                self.update_via_recovery_interupted = False
                                
                                response = {'hours':now.hour,
                                            'minutes':now.minute,
                                            'shell_date':shell_date,
                                            'ntp':current_ntp_state,
                                            'backup_exists':self.backup_file_exists,
                                            'restore_exists':self.restore_file_exists,
                                            'disk_usage':self.disk_usage,
                                            'allow_anonymous_mqtt':self.allow_anonymous_mqtt, 
                                            'hardware_clock_detected':self.hardware_clock_detected,
                                            'exhibit_mode':self.exhibit_mode,
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
                                            'recovery_version':self.recovery_version,
                                            'latest_recovery_version':self.latest_recovery_version,
                                            'busy_updating_recovery':self.busy_updating_recovery,
                                            'recovery_partition_exists':self.recovery_partition_exists,
                                            'allow_update_via_recovery':self.allow_update_via_recovery,
                                            'updating_recovery_failed':self.updating_recovery_failed,
                                            'update_via_recovery_aborted':local_update_via_recovery_aborted,
                                            'update_via_recovery_interupted':local_update_via_recovery_interupted,
                                            'user_partition_expanded':self.user_partition_expanded,
                                            'unused_volume_space': self.unused_volume_space,
                                            'device_model':self.device_model.rstrip(),
                                            'device_kernel':self.device_kernel.rstrip(),
                                            'device_linux':self.device_linux.rstrip(),
                                            'device_sd_card_size':self.device_sd_card_size,
                                            'has_cups':self.has_cups,
                                            'user_partition_expansion_failed': self.user_partition_expansion_failed,
                                            'debug':self.DEBUG
                                        }
                                        
                            except Exception as ex:
                                print("Error in /init response preparation: " + str(ex))
                            
                            
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
                                        
                                        if os.path.isfile(self.restore_file_path):
                                            if self.DEBUG:
                                                print("file save complete")
                                                
                                            # make sure the tar file is valid
                                            tar_test_command = 'tar -xf ' + str(self.restore_file_path) + ' -O > /dev/null'
                                            if self.DEBUG:
                                                print("tar_test_command: " + str(tar_test_command))
                                                
                                            tar_test = run_command(tar_test_command)
                                            if "error" in tar_test.lower():
                                                state = 'invalid tar file'
                                                if self.DEBUG:
                                                    print("untar test of backup file resulted in error: " + str(tar_test))
                                            else:
                                                restore_command = 'sudo cp ' + str(self.restore_backup_script_path) + ' ' + str(self.actions_file_path)
                                                if self.DEBUG:
                                                    print("restore backup copy command: " + str(restore_command))
                                                os.system(restore_command)
                                            
                                                # clean up the non-blocking file if it exists. TODO: is this still used?
                                                if os.path.isfile(self.boot_path + '/bootup_actions_non_blocking.txt'):
                                                    if self.DEBUG:
                                                        print("/boot/firmware/bootup_actions_non_blocking.txt still existed")
                                                    os.system('sudo rm ' + str(self.boot_path) + '/bootup_actions_non_blocking.txt')
                                            
                                                state = 'ok'
                                            
                                        else:
                                            if self.DEBUG:
                                                print("Error: self.restore_backup_script_path did not exist?")
                                            state = 'missing file'
                                else:
                                    if self.DEBUG:
                                        print("Error: wrong file extension")
                                    state = 'wrong file extension'
                                        
                            except Exception as ex:
                                if self.DEBUG:
                                    print("Error saving data to file: " + str(ex))
                                state = 'error'
                            #data = self.save_photo(str(request.body['filename']), str(request.body['filedata']), str(request.body['parts_total']), str(request.body['parts_current']) ) #new_value,date,property_id
                            #if isinstance(data, str):
                            #    state = 'error'
                            #else:
                            #    state = 'ok'
                            if self.DEBUG:
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


    
    
    def get_avahi_lines(self):
        if self.DEBUG:
            print("in get_avahi_lines")
        avahi_lines = []
        avahi_browse_command = ["avahi-browse","-p","-l","-a","-r","-k","-t"] # avahi-browse -p -l -a -r -k -t
        
        try:
            avahi_scan_result = subprocess.check_output(avahi_browse_command) #.decode()) # , universal_newlines=True, stdout=subprocess.PIPE
            avahi_encoding = 'latin1'
            try:
                avahi_encoding = chardet.detect(avahi_scan_result)['encoding']
                if self.DEBUG:
                    print("detected avahi output encoding: " + str(avahi_encoding))
            except Exception as ex:
                print("error getting avahi output encoding: " + str(ex))
                
            avahi_scan_result = avahi_scan_result.decode(avahi_encoding)
            for line in avahi_scan_result.split('\n'):
                # replace ascii codes in the string. E.g. /032 is a space
                for x in range(127):
                    anomaly = "\\" + str(x).zfill(3)
                    if anomaly in line:
                        line = line.replace(anomaly,chr(x))
                avahi_lines.append(line)
        
        except Exception as ex:
            if self.DEBUG:
                print("Error in get_avahi_lines: " + str(ex))
                
        return avahi_lines
        
    
    
    def detect_printers(self):
        if self.DEBUG:
            print("in detect_printers")

        self.connected_printers = {}

        if self.printing_allowed:
            try:
            
                lpstat_output = run_command("lpstat -v")
                if self.DEBUG:
                    print("detect_printers: lpstat before: " + str(lpstat_output))
            
                cups_output = run_command("sudo lpinfo -l --timeout 10 -v | grep 'uri = lpd://' -A 5")
                avahi_output = run_command("avahi-browse -p -l -a -r -k -t | grep '_printer._tcp' | grep IPv4")
            
                #print("\n\n--")
                #print("cups_output: " + str(cups_output))
                #print("--")
                #print("cups_parts: " + str(cups_parts))
                #print("--")
                #print("avahi_output: " + str(avahi_output))
                #print("--\n\n")
            
                if avahi_output != None and cups_output != None:
                    cups_parts = cups_output.split('Device: uri = lpd://')
                    if self.DEBUG:
                        print("Detected number of printers: " + str(len(cups_parts)-1))
            
                    printer_counter = 0
                    found_default_printer_again = False
            
                    for printer_info in cups_parts:
                        printer_counter += 1
                        if len(printer_info) > 10:
                            if self.DEBUG:
                                print("\nprinter_info: " + str(printer_info))
                            printer_lines = printer_info.splitlines()
                            for printer_line in printer_lines:
                                if 'make-and-model =' in printer_line:
                                    printer_name = printer_line.split('make-and-model =')[1]
                                
                                    if len(printer_name) > 2:
                                        safe_printer_name = printer_name.strip()
                                        safe_printer_name = safe_printer_name.replace(' ','_')
                                        safe_printer_name = re.sub(r'\W+', '', safe_printer_name)
                                        if self.DEBUG:
                                            print("\nsafe_printer_name: " + str(safe_printer_name))
                                        for line in avahi_output.splitlines():
                                            if self.DEBUG:
                                                print("avahi line: " + str(line))
                                            ip_address_list = re.findall(r'(?:\d{1,3}\.)+(?:\d{1,3})', str(line))
                                            if len(ip_address_list) > 0:
                                                ip_address = str(ip_address_list[0])
                                                if valid_ip(ip_address):
                                                    
                                                    self.connected_printers[safe_printer_name] = {'id':safe_printer_name,'ip':ip_address,'default':False}
                                                    
                                                    if self.DEBUG:
                                                        print("avahi-browse line with valid IP: " + str(line))
                                                        print("ADDING PRINTER: " + str(safe_printer_name) + "  ->  " + str(ip_address))
                                                    add_printer_command = "sudo lpadmin -p " + str(safe_printer_name) + " -E -v socket://" + str(ip_address) + "  -o printer-error-policy=abort-job"
                                                    if self.DEBUG:
                                                        print("add_printer_command: " + str(add_printer_command))
                                                    os.system(str(add_printer_command)) # -P # -o printer-error-policy=abort-job -u allow:all
                                                
                                                    if not 'default_printer' in self.persistent_data:
                                                        if self.DEBUG:
                                                            print("Setting initial default printer: " + str(safe_printer_name))
                                                        self.persistent_data['default_printer'] = safe_printer_name
                                                        found_default_printer_again = True
                                                    else:
                                                        if self.persistent_data['default_printer'] == safe_printer_name:
                                                            found_default_printer_again = True
                                            
                                                    if printer_counter == len(cups_parts) and found_default_printer_again == False:
                                                        if self.DEBUG:
                                                            print("could not find the previous default printer again, setting a new one")
                                                        self.persistent_data['default_printer'] = safe_printer_name
        
                    if found_default_printer_again == True and 'default_printer' in self.persistent_data:
                        if self.DEBUG:
                            print("Found the default printer (again): " + str(self.persistent_data['default_printer']))
                        os.system('lpoptions -d  ' + str(self.persistent_data['default_printer']))
                        self.connected_printers[ self.persistent_data['default_printer'] ]['default'] = True
                
            
            except Exception as ex:
                print("Error in detect_printers: " + str(ex))
        
        lpstat_output = run_command("lpstat -v")
        if self.DEBUG:
            print("lpstat -v after printer scan: " + str(lpstat_output))
            print("\nself.connected_printers:\n")
            print(json.dumps(self.connected_printers, indent=4, sort_keys=True))
        #if not 'No destinations added' in lpstat_output:
        #    for connected in lpstat_output.splitlines():
        #        if ':' in connnected:
        #            connected = connected.replace('device for ','')
        #            connected = connected.replace('socket://','')
        #            connected_parts = connected.split(':')
                    
            
        return self.connected_printers
       
       
    
    def update_backup_info(self, directory=None):
        if self.DEBUG:
            print("debug: in update_backup_info")
        try:
            if directory == None:
                directory = self.user_profile['baseDir']
            self.backup_file_exists = os.path.isfile(self.backup_file_path)
            self.restore_file_exists = os.path.isfile(self.restore_file_path)
            self.photo_frame_installed = os.path.isdir(self.photos_dir_path)
            self.disk_usage = shutil.disk_usage(directory)
            self.get_backup_sizes()
        except Exception as ex:
            print("error in update_backup_info: " + str(ex))



    # Gets the size of files and folders for the extended backup
    def get_backup_sizes(self):
        if self.DEBUG:
            print("in get_backup_sizes")
            
        # get logs file size
        if os.path.exists(self.log_db_file_path):
            self.log_size = os.path.getsize(self.log_db_file_path)
            if self.DEBUG:
                print("log_size: " + str(self.log_size))
        else:
            if self.DEBUG:
                print("Error, log database file did not exist?")
            
        # calculate photos dir size
        if os.path.isdir(self.photos_dir_path):
            photos_size = 0
            for path, dirs, files in os.walk(self.photos_dir_path):
                for f in files:
                    fp = os.path.join(path, f)
                    photos_size += os.path.getsize(fp)
            if self.DEBUG:
                print("photos_size: " + str(photos_size))
            self.photos_size = photos_size
        else:
            if self.DEBUG:
                print("photos dir did not exist, photo-frame addon not installed?: " + str(self.photos_dir_path))
                
                
        # calculate uploads dir size
        if os.path.isdir(self.uploads_dir_path):
            uploads_size = 0
            for path, dirs, files in os.walk(self.uploads_dir_path):
                for f in files:
                    fp = os.path.join(path, f)
                    uploads_size += os.path.getsize(fp)
            if self.DEBUG:
                print("uploads_size: " + str(uploads_size))
            self.uploads_size = uploads_size
        else:
            if self.DEBUG:
                print("Error, uploads dir did not exist?")


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
                
                if self.backup_more == True:
                    
                    self.get_backup_sizes()
                    
                    # if logs and photos together are less than 90Mb, then all is well.
                    if self.log_size + self.photos_size + self.uploads_size < 90000000:
                        if self.log_size != 0:
                            if self.DEBUG:
                                print("adding logs to the backup command")
                            extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','log','logs.sqlite3')
                        if self.photos_size != 0:
                            if self.DEBUG:
                                print("adding photos to the backup command")
                            extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','data','photo-frame','photos')
                        if self.uploads_size != 0:
                            if self.DEBUG:
                                print("adding uploads to the backup command")
                            extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','uploads')
                        
                        
                    # if together they are too big, then prioritize the logs
                    elif self.log_size < 90000000 and self.log_size != 0:
                        if self.DEBUG:
                            print("adding big log to backup command, at the cost of photos")
                        #log_option = './log '
                        extra_tar_commands += '; tar -rf ' + str(self.backup_file_path)  + ' ' + os.path.join('.','log','logs.sqlite3') #'self.log_db_file_path + ' -T -'
                        self.backup_photos_failed = True
                    
                    # If the logs are too big, perhaps the photos can be backupped
                    elif self.photos_size < 90000000 and self.photos_size != 0:
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
                
                backup_command = 'cd ' + str(self.user_profile['baseDir']) + '; find ./config ./data -maxdepth 2 -name "*.json" -o -name "*.xtt" -o -name "*.yaml" -o -name "*.xml" -o -name "*.sqlite3" -o -name "*.blacklisted_devices" -o -name "*.trusted_devices" -o -name "*.ignored_devices" -o -name "*.db"  | tar -cf ' + str(self.backup_file_path) + ' -T -' 
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




    # check what version of the recovery partition is installed
    def check_recovery_partition(self):
        if self.DEBUG:
            print("in check_recovery_partition")
            
        try:
            lsblk_output = run_command('lsblk')
            if not 'mmcblk0p4' in lsblk_output:
                if self.DEBUG:
                    print("warning, recovery partition is not supported")
                self.recovery_partition_exists = False
            else:
                if self.DEBUG:
                    print("mmcblk0p4 partition exists")
                self.recovery_partition_exists = True
                
                if not os.path.exists(self.recovery_partition_mount_point):
                    os.system('sudo mkdir -p ' + str(self.recovery_partition_mount_point))
                
                candle_recovery_text_path = os.path.join(self.recovery_partition_mount_point,'candle_recovery.txt')
                if os.path.exists(candle_recovery_text_path):
                    if self.DEBUG:
                        print("warning, recovery partition seems to already be mounted")
                else:
                    
                    if os.path.exists(self.recovery_partition_mount_point):
                        if self.DEBUG:
                            print("mounting recovery partition")
                        os.system('sudo mount -r -t auto /dev/mmcblk0p3 ' + self.recovery_partition_mount_point)
                        time.sleep(.2)
                    else:
                        if self.DEBUG:
                            print("Error, mount point for recovery partition did not exist")
                        return
                    
                # Check if the recovery partition was mounted properly
                if os.path.exists(candle_recovery_text_path) == False:
                    if self.DEBUG:
                        print("ERROR, mounting recovery partition failed") # could be a rare occurance of an unformatted recovery partition
                        if os.path.exists(os.path.join(self.recovery_partition_mount_point,'bin')):
                            print("However, /bin does exist, so the partition is mounted?")
                else:
                    with open(candle_recovery_text_path, "r") as version_file:
                        self.recovery_version = int(version_file.read())
                        if self.DEBUG:
                            print("recovery partition version: " + str(self.recovery_version))
                    
                    # not really needed at the moment, as a 32 bit partition is fine for both types of systems for now.
                    if os.path.exists(os.path.join(self.recovery_partition_mount_point,'64bits.txt')):
                        self.recovery_partition_bits = 64
                    
                    
                    # Check if the kernel modules of the recovery partition are the correct version, since the recovery partion is started with the kernel from the system partion.
                    # But only make the effort if the system isn't connected via Ethernet already.
                    """
                    uname_parts = run_command('uname -a').split()
                    if len(uname_parts) > 2:
                        linux_version_string = str(uname_parts[2])
                        if self.DEBUG:
                            print("linux_version_string: " + str(linux_version_string))
                        intended_kernel_modules_path = '/mnt/recoverypart/lib/modules/' + linux_version_string
                        
                        if os.path.exists('/mnt/recoverypart/lib/modules'):
                            if not os.path.exists(intended_kernel_modules_path):
                                if self.DEBUG:
                                    print("Warning, will attempt to fix incorrect kernel modules folder: " + str(intended_kernel_modules_path))
                                os.system('sudo rm -rf /mnt/recoverypart/lib/modules/*; sudo cp -r /lib/modules/* /mnt/recoverypart/lib/modules/')
                                
                            else:
                                if self.DEBUG:
                                    print("OK, The recovery partition has the correct kernel modules folder")
                        else:
                            if self.DEBUG:
                                print("Error, the /lib/modules folder could not be found; is the recovery partition really mounted?")
                    """
                    
                os.system('sudo umount ' + str(self.recovery_partition_mount_point))
                
                if self.recovery_version == 0:
                    if self.DEBUG:
                        print("unable to get recovery partition version (0)")
                elif self.recovery_version < self.latest_recovery_version:
                    if self.DEBUG:
                        print("recovery partition should be updated")
                elif self.recovery_version >= self.latest_recovery_version:
                    if self.DEBUG:
                        print("recovery partition is up to date")
                    # recovery partition is up to date
                    
                    if os.path.exists(self.boot_path + '/cmdline-update.txt') == False:
                        if os.path.exists(self.boot_path):
                            if self.DEBUG:
                                print("creating missing cmdline-update.txt")
                            os.system('echo "console=tty3 root=/dev/mmcblk0p3 rootfstype=ext4 elevator=deadline fsck.repair=yes rootwait consoleblank=0 net.ifnames=0 quiet plymouth.ignore-serial-consoles splash logo.nologo" | sudo tee ' + str(self.boot_path) + '/cmdline-update.txt')
                    
                    if os.path.exists(self.boot_path + '/cmdline-update.txt'):
                        if self.DEBUG:
                            print("/boot/firmware/cmdline-update.txt exists, update may happen via recovery partition")
                        
                        if self.DEBUG:
                            print("Update may happen via recovery partition (if the network cable is also plugged in)")
                        self.allow_update_via_recovery = True
                        
                        #if self.bits == 64:
                            
                
        except Exception as ex:
            if self.DEBUG:
                print("Error in check_recovery_partition: " + str(ex))
            


    
    

    def update_recovery_partition(self):
        if self.DEBUG:
            print("in update_recovery_partition")
        try:
            
            # this should never be needed... but just in case.
            lsblk_output = run_command('lsblk')
            if not 'mmcblk0p4' in lsblk_output:
                if self.DEBUG:
                    print("Error, updating recovery partition was called, but system does not have four partitions. Aborting!")
                return
            
            if self.busy_updating_recovery > 0:
                if self.DEBUG:
                    print("Warning, already busy update_recovery_partition. Aborting.")
                return
                
            self.updating_recovery_failed = False
            self.busy_updating_recovery = 1
            
            if os.path.exists('/home/pi/.webthings/recovery.fs.tar.gz'):
                if self.DEBUG:
                    print("Warning, recovery.fs.tar.gz already exists. Deleting")
                os.system('sudo rm /home/pi/.webthings/recovery.fs.tar.gz')
                
            if os.path.exists('/home/pi/.webthings/recovery.fs'):
                if self.DEBUG:
                    print("Warning, recovery.fs.tar.gz already exists. Deleting")
                os.system('sudo rm /home/pi/.webthings/recovery.fs')
                
            
            recovery_checksum = None
            try:
                with urllib.request.urlopen('http://www.candlesmarthome.com/img/recovery/recovery.fs.tar.gz.checksum') as f:
                    recovery_checksum = f.read().decode('utf-8')
                    recovery_checksum = recovery_checksum.strip()
                    if self.DEBUG:
                        print("recovery checksum should be: ->" + str(recovery_checksum) + "<-")
            except Exception as ex:
                if self.DEBUG:
                    print("Aborting recovery partition update, error trying to download image checksum: " + str(ex))
                self.updating_recovery_failed = True
                return
            
            if recovery_checksum == None:
                if self.DEBUG:
                    print("Aborting recovery partition update, desired recovery checksum was still None")
                self.updating_recovery_failed = True
                return
            
            
            if os.path.exists(os.path.join(self.recovery_partition_mount_point,'bin')):
                if self.DEBUG:
                    print("Warning, recovery partition seemed to already be mounted! Will attempts to unmount it first")
                os.system('sudo umount ' + str(self.recovery_partition_mount_point))
                if os.path.exists(os.path.join(self.recovery_partition_mount_point,'bin')):
                    if self.DEBUG:
                        print("Error, unmounting recovery partition (that shouldn't have been mounted in the first place) failed")
                    self.updating_recovery_failed = True
                    return
            
            os.system('wget https://www.candlesmarthome.com/img/recovery/recovery.fs.tar.gz -O /home/pi/.webthings/recovery.fs.tar.gz')
            
            if not os.path.exists('/home/pi/.webthings/recovery.fs.tar.gz'):
                if self.DEBUG:
                    print("recovery image failed to download, waiting a few seconds and then trying once more")
                time.sleep(10)
                os.system('wget https://www.candlesmarthome.com/img/recovery/recovery.fs.tar.gz -O /home/pi/.webthings/recovery.fs.tar.gz')
                #os.system('cd /home/pi/.webthings; rm recovery.fs; wget https://www.candlesmarthome.com/img/recovery/recovery.fs.tar.gz -O recovery.fs.tar.gz') #; tar -xf recovery.fs.tar.gz
            
            if not os.path.exists('/home/pi/.webthings/recovery.fs.tar.gz'):
                if self.DEBUG:
                    print("Recovery partition file failed to download")
                self.updating_recovery_failed = True
                return
            
            if self.DEBUG:
                print("recovery partition file downloaded OK")
            
            downloaded_recovery_file_checksum = run_command("md5sum /home/pi/.webthings/recovery.fs.tar.gz | awk '{print $1}'")
            downloaded_recovery_file_checksum = downloaded_recovery_file_checksum.strip()
            if self.DEBUG:
                print("file checksum    : ->" + str(downloaded_recovery_file_checksum) + "<-")
                print("desired checksum : ->" + str(recovery_checksum) + "<-")
                print("downloaded_recovery_file_checksum length should be 32: " + str(len(downloaded_recovery_file_checksum)))
                print("recovery_checksum length should be 32: " + str(len(recovery_checksum)))
            if len(recovery_checksum) == 32 and len(downloaded_recovery_file_checksum) == 32 and str(recovery_checksum) == str(downloaded_recovery_file_checksum):
                if self.DEBUG:
                    print("checksums matched")
                self.busy_updating_recovery = 2
                
            else:
                if self.DEBUG:
                    print("Aborting, downloaded recovery img file checksums did not match")
                self.updating_recovery_failed = True
                os.system('sudo rm /home/pi/.webthings/recovery.fs.tar.gz')
                return
            
            self.busy_updating_recovery = 2
            
            os.system('cd /home/pi/.webthings; tar -xf recovery.fs.tar.gz')
            
            
            # Recovery image failed to download/extract
            if os.path.exists('/home/pi/.webthings/recovery.fs') == False:
                if self.DEBUG:
                    print("recovery image failed to download or extract!")
                os.system('sudo rm /home/pi/.webthings/recovery.fs; sudo rm /home/pi/.webthings/recovery.fs.tar.gz')
                self.updating_recovery_failed = True
                
            # Good to go!
            else:
                if self.DEBUG:
                    print("recovery image file was downloaded and extracted succesfully")
                self.busy_updating_recovery = 3
                
                #os.system('sudo mkfs -g -t ext4 /dev/mmcblk0p3 -F') # format the partition first
                os.system('sudo dd if=/dev/zero of=/dev/mmcblk0p3 bs=1M') # empty
                
                self.busy_updating_recovery = 4
                
                os.system('sudo dd if=/home/pi/.webthings/recovery.fs of=/dev/mmcblk0p3 bs=1M; sudo rm /home/pi/.webthings/recovery.fs; sudo rm /home/pi/.webthings/recovery.fs.tar.gz')

                self.check_recovery_partition()
                
                if self.recovery_version >= self.latest_recovery_version:
                    self.busy_updating_recovery = 5
                
            # clean up any downloaded files
            if os.path.exists('/home/pi/.webthings/recovery.fs.tar.gz'):
                if self.DEBUG:
                    print("Warning, recovery.fs.tar.gz already exists. Deleting")
                os.system('sudo rm /home/pi/.webthings/recovery.fs.tar.gz')
                
            if os.path.exists('/home/pi/.webthings/recovery.fs'):
                if self.DEBUG:
                    print("Warning, recovery.fs.tar.gz already exists. Deleting")
                os.system('sudo rm /home/pi/.webthings/recovery.fs')
                    
                
        except Exception as ex:
            print("Error in update_recovery_partition: " + str(ex))
        
        # old method of mounting the entire disk image
        #sudo losetup --partscan /dev/loop0 recovery.fs
        #sudo dd if=/dev/loop0p2 of=/dev/mmcblk0p3 bs=1M
        #losetup --detach /dev/loop0 
        
    


    def switch_to_recovery(self):
        if self.DEBUG:
            print("in switch_to_recovery")
        try:
            if self.recovery_version > 0 and self.recovery_version == self.latest_recovery_version:
                if os.path.exists(self.boot_path + '/cmdline-update.txt') and os.path.exists(self.boot_path + '/cmdline-candle.txt'):
                    if self.busy_updating_recovery == 0 or self.busy_updating_recovery == 5:
                        self.check_ethernet_connected()
                        if self.ethernet_connected:
                            if self.DEBUG:
                                print("copying recovery cmdline over the existing one")
                            os.system('sudo cp ' + str(self.boot_path) + '/cmdline-update.txt ' + str(self.boot_path) + '/cmdline.txt')
                            return True
                        
                        else:
                            if self.DEBUG:
                                print("Error, no ethernet cable connected")    
                    else:
                        if self.DEBUG:
                            print("Error, will not start switch to recovery as busy_updating_recovery is in limbo, indicating a failed recovery partition update: " + str(self.busy_updating_recovery))
                else:
                    if self.DEBUG:
                        print("Error, /boot/firmware/cmdline-update.txt or /boot/firmware/cmdline-candle.txt does not exist")
            else:
                if self.DEBUG:
                    print("Error, recovery partition does not exist/has not been installed (still version 0)")
                    
        except Exception as ex:
            if self.DEBUG:
                print("Error in switch_to_recovery: " + str(ex))
        return False
        
        
        
    def expand_user_partition(self):
        if self.DEBUG:
            print("in expand_user_partition")
            
        # List unused disk space: 
        # echo -e "F\nq" | sudo fdisk /dev/mmcblk0
        
        # current partition size in gigabytes:
        # fdisk -l | grep mmcblk0p4 | awk '{print $5}' | tr -d 'G\n'
        
        # starting sector:
        # sudo fdisk -l | grep mmcblk0p4 | awk '{print $2}' | tr -d 'G\n'
        
        #if not os.path.exists(self.boot_path + '/candle_user_partition_expanded.txt'):
        if self.user_partition_expanded == False:
            
            
            # save information to candle_log.txt
            date_string = run_command('date')
            if self.DEBUG:
                print("date: " + str(date))    
            os.system('echo "' + str(date_string) + ' expanding user partition" | sudo tee -a ' + str(self.boot_path) + '/candle_log.txt')
            os.system('sudo fdisk -l | sudo tee -a ' + str(self.boot_path) + '/candle_log.txt')
            if os.path.exists('/home/pi/.webthings/candle.log'):
                os.system('echo "' + str(date_string) + ' expanding user partition" | sudo tee -a /home/pi/.webthings/candle.log')
            
            start_sector = run_command("sudo fdisk -l | grep mmcblk0p4 | awk '{print $2}' | tr -d '\n'")
            if start_sector.isdigit() and len(start_sector) > 4:
                if self.DEBUG:
                    print("start sector: " + str(start_sector))
            
                #expand_command = 'echo -e "d\n4\nn\np\n' + str(start_sector) + '\n\nN\np\nq" | sudo fdisk /dev/mmcblk0'
                expand_command = 'echo -e "d\n4\nn\np\n' + str(start_sector) + '\n\nN\nw\nq" | sudo fdisk /dev/mmcblk0'
                #expand_string = "d\n4\nn\np\n" + str(start_sector) + "\n\nN\nw\nq"
                if self.DEBUG:
                    print("expand_command: " + str(expand_command))
                expand_output = run_command(expand_command)
                if self.DEBUG:
                    print("expand output: " + str(expand_output))
                resize2fs_output = run_command('sudo resize2fs /dev/mmcblk0p4')
                if self.DEBUG:
                    print("resize2fs_output: " + str(resize2fs_output))
                    print("rebooting...")
                    
                
                new_unused_space = int(run_command("sudo parted /dev/mmcblk0 unit B print free | grep 'Free Space' | tail -n1 | awk '{print $3}' | tr -d 'B\n'"))
                #print("unused_volume_space: " + str(self.unused_volume_space))
            
                if new_unused_space < 1000000000:
                    self.user_partition_expanded = True
                    os.system('sudo touch ' + str(self.boot_path) + '/candle_user_partition_expanded.txt')
                    os.system('sudo reboot')
                else:
                    self.user_partition_expansion_failed = True
                
                return True
                
            else:
                if self.DEBUG:
                    print("start_sector was not a (long) digit")
        else:
            if self.DEBUG:
                print("spotted file indicating file_system was already expanded?")

        return False
        
        
    def test_speakers(self):
        if self.DEBUG:
            print("In speaker test")
        os.system('speaker-test -c4 -twav -l1')
        
        
    
    def reinstall_app_store(self):
        if self.DEBUG:
            print("In reinstall_app_store")
            
        try:
            git_command = "git clone https://github.com/createcandle/candleappstore.git /tmp/candleappstore"
            target_dir = os.path.join(self.user_profile['addonsDir'], 'candleappstore')
            if self.DEBUG:
                print(" - target_dir:" + str(target_dir))
                print(" - git command: \n" + str(git_command))
            
            
            if 'addons' in target_dir and 'candleappstore' in target_dir:
                if os.path.isdir('/tmp/candleappstore'):
                    os.system("rm -rf /tmp/candleappstore")
                    if self.DEBUG:
                        print("warning, had to clean up existing temporary dir /tmp/candleappstore")
            
                os.system('mkdir -p /tmp/candleappstore')
                if os.path.isdir('/tmp/candleappstore'):
                    if self.DEBUG:
                        print("GIT cloning candleappstore into /tmp/candleappstore")
                    os.system(git_command)
            
                    if os.path.isdir('/tmp/candleappstore/pkg') and os.path.isdir('/tmp/candleappstore/js') and os.path.isdir('/tmp/candleappstore/views'):
                        os.system("mv /tmp/candleappstore " + str(target_dir))
                        if self.DEBUG:
                            print("in theory the candleappstore addon has been moved into place")
                        run_command('sleep 1; sudo systemctl restart webthings-gateway.service')
                        return True
        
            if self.DEBUG:
                print("reinstall_app_store failed")
                
        except Exception as ex:
            print("Caught error in reinstall_app_store: " + str(ex))
            
        return False
                    
                    
                    
                    

        
        
    def update_config_txt(self):
        
        with open(self.config_txt_path) as f:
            pass
            #self.persistent_data = json.load(f)
        
        
        power_settings_indicator = """# DO NOT PLACE ANYTHING BELOW POWER_SETTINGS_START LINE, IT MAY BE REMOVED BY THE POWER SETTINGS ADDON
        
        #POWER_SETTINGS_START
        
        """
        
        
        """
        #dtparam=pwr_led_activelow=off
        #dtparam=act_led_trigger=none
        #dtparam=act_led_activelow=off
        #dtparam=eth_led0=14
        #dtparam=eth_led1=14
        """
        
        # open( self.config_txt_path, 'w+' )
        
        
    def save_persistent_data(self):
        if self.DEBUG:
            print("Saving to persistence data store")
        try:
            json.dump( self.persistent_data, open( self.persistence_file_path, 'w+' ) ,indent=4)
            self.persistent_changed = False
            return True
        except Exception as ex:
            if self.DEBUG:
                print("Error: could not store data in persistent store: " + str(ex) )
        return False



    def unload(self):
        if self.DEBUG:
            print("Shutting down power settings adapter")
        self.running = False
        os.system('sudo timedatectl set-ntp on') # If add-on is removed or disabled, re-enable network time protocol.
        if os.path.islink(self.backup_download_dir):
            if self.DEBUG:
                print("removing backup download symlink")
            os.system('unlink ' + self.backup_download_dir) # remove symlink, so the backup files can not longer be downloaded



def run_command(cmd, timeout_seconds=60):
    try:
        p = subprocess.run(cmd, timeout=timeout_seconds, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, universal_newlines=True)

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