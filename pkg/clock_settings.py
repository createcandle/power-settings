import os
import sys

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))

import datetime
import json
import functools

from requests import request
from pkg.utils.command import run_command

try:
    from gateway_addon import APIResponse
except:
    print("Import APIResponse from gateway_addon failed. Use at least WebThings Gateway version 0.10")


print = functools.partial(print, flush=True)

_CONFIG_PATHS = [
    os.path.join(os.path.expanduser('~'), '.webthings', 'config'),
]

if 'WEBTHINGS_HOME' in os.environ:
    _CONFIG_PATHS.insert(0, os.path.join(os.environ['WEBTHINGS_HOME'], 'config'))

class Clock:
    """
    Class that represent a system clock
    """

    def __init__(self, DEBUG):
        self.DEBUG = DEBUG
        print(f"clock debug: {DEBUG}")
        self.hardware_clock_detected = False
        self.do_not_use_hardware_clock = False
        self.hardware_clock_file_path = '/boot/candle_hardware_clock.txt'

    def initialize_clock(self):
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
            
            response = {'hours':now.hour,
                        'minutes':now.minute,
                        'ntp':current_ntp_state,
                        'backup_exists':'self.backup_file_exists',
                        'restore_exists':'self.restore_file_exists',
                        'disk_usage':'self.disk_usage',
                        'allow_anonymous_mqtt':'self.allow_anonymous_mqtt', 
                        'hardware_clock_detected':self.hardware_clock_detected,
                        'candle_version':'self.candle_version',
                        'debug':self.DEBUG
                    }
            return response
        except Exception as ex:
            print("Init error: " + str(ex))
            return False

    def set_time(self, request):
        if self.DEBUG:
            print(f"{__name__}: set_time")
        try:
            self._do_set_time(str(request.body['hours']),request.body['minutes'])
            
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
    def set_ntp(self, request):
        if self.DEBUG:
            print("New NTP state = " + str(request.body['ntp']))
            print(f"{__name__}: ntp type: {type(request.body['ntp'])}")
        self._do_set_ntp_state(request.body['ntp'])
        return APIResponse(
            status=200,
            content_type='application/json',
            content=json.dumps("Changed Network Time state to " + str(request.body['ntp'])),
        )

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

            if self.do_not_use_hardware_clock:
                if os.path.isfile(self.hardware_clock_file_path):
                    if self.DEBUG:
                        print("removing " + str(self.hardware_clock_file_path))
                    run_command('sudo rm ' + str(self.hardware_clock_file_path))
            else:
                self.hardware_clock_check()
                    
            
        except Exception as ex:
            print("Error in hardware_clock_check: " + str(ex))

    def _do_set_time(self, hours, minutes, seconds=0):

        if self.DEBUG:
            print("Setting the new time")
        
        if hours.isdigit() and minutes.isdigit():
            
            the_date = str(datetime.datetime.now().strftime('%Y-%m-%d'))
        
            time_command = "sudo date --set '" + the_date + " "  + str(hours) + ":" + str(minutes) + ":00'"
            if self.DEBUG:
                print("new set date command: " + str(time_command))
        
            try:
                os.system(time_command)
                #TODO use subprocess to get return of the command
                #command return the current system date
                
                # If hardware clock module exists, set its time too.
                if self.hardware_clock_detected:
                    print('also setting hardware clock time')
                    os.system('sudo hwclock -w')
                    #TODO use subprocess to get command return
                    
            except Exception as e:
                print("Error setting new time: " + str(e))

    def _do_set_ntp_state(self,new_state):

        if self.DEBUG:
            print("Setting NTP state to: " + str(new_state))
        try:
            if new_state:
                os.system('sudo timedatectl set-ntp on') 
                # TODO use subprocess to get command return
                if self.DEBUG:
                    print("Network time turned on")
            else:
                os.system('sudo timedatectl set-ntp off') 
                # TODO use subprocess to get command return
                if self.DEBUG:
                    print("Network time turned off")
        except Exception as e:
            print("Error changing NTP state: " + str(e))