import os

class Clock:
    """
    Class that represent a system clock
    """

    def __init__(self, DEBUG):
        self.DEBUG = DEBUG
        self.hardware_clock_detected = False
        self.do_not_use_hardware_clock = False
        self.hardware_clock_file_path = '/boot/candle_hardware_clock.txt'

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

    #### end of the part to rework in clock module #### 