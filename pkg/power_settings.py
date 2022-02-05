"""Power Settings API handler."""


import os
import sys
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import json
from time import sleep
import datetime
import functools
import subprocess

try:
    from gateway_addon import APIHandler, APIResponse
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
            
            self.DEBUG = False
            
            if self.DEBUG:
                print("self.manager_proxy = " + str(self.manager_proxy))
                print("Created new API HANDLER: " + str(manifest['id']))
                print("user_profile: " + str(self.user_profile))
                
        except Exception as e:
            print("Failed to init UX extension API handler: " + str(e))
        
        

    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        
        try:
        
            if request.method != 'POST':
                return APIResponse(status=404)
            
            if request.path == '/init' or request.path == '/set-time' or request.path == '/set-ntp' or request.path == '/shutdown' or request.path == '/reboot' or request.path == '/restart' or request.path == '/ajax':

                try:
                    if request.path == '/ajax':
                        if 'action' in request.body:
                            action = request.body['action']
                        
                            if action == 'reset':
                                
                                resetz2m = "false"
                                if 'keep_z2m' in request.body:
                                     if request.body['keep_z2m'] == False:
                                         resetz2m = "true"
                                         
                                os.system('sudo chmod +x ~/.webthings/addons/power-settings/factory_reset.sh') 
                                os.system('/home/pi/.webthings/addons/power-settings/factory_reset.sh ' + str(resetz2m) + " &")
                                
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
                            
                            
                            response = {'hours':now.hour,'minutes':now.minute,'ntp':current_ntp_state}
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
                            return APIResponse(
                              status=200,
                              content_type='application/json',
                              content=json.dumps("Time set"),
                            )
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error setting time: " + str(ex))
                            return APIResponse(
                              status=500,
                              content_type='application/json',
                              content=json.dumps("Error while setting time: " + str(ex)),
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
            except Exception as e:
                print("Error setting new time: " + str(e))


    def set_ntp_state(self,new_state):
        if self.DEBUG:
            print("Setting NTP state")
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



    def unload(self):
        if self.DEBUG:
            print("Shutting down adapter")
        os.system('sudo timedatectl set-ntp on') # If add-on is removed or disabled, re-enable network time protocol.



def run_command(cmd, timeout_seconds=60):
    try:
        p = subprocess.run(cmd, timeout=timeout_seconds, stdout=subprocess.PIPE, stderr=subprocess.PIPE, shell=True, universal_newlines=True)

        if p.returncode == 0:
            return p.stdout  + '\n' + "Command success" #.decode('utf-8')
            #yield("Command success")
        else:
            if p.stderr:
                return "Error: " + str(p.stderr)  + '\n' + "Command failed"   #.decode('utf-8'))

    except Exception as e:
        print("Error running Arduino CLI command: "  + str(e))
        