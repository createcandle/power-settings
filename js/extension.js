(function() {
    class PowerSettings extends window.Extension {
        constructor() {
            super('power-settings');
            this.addMenuEntry('Power');

            this.debug = false;

            const getUrl = window.location;
            this.baseUrl = getUrl.protocol + "//" + getUrl.host + "/things";

            this.content = '';
            fetch(`/extensions/${this.id}/views/content.html`)
                .then((res) => res.text())
                .then((text) => {
                    this.content = text;
                    if (document.location.href.endsWith("power-settings")) {
                        this.show();
                    }
                })
                .catch((e) => console.error('Failed to fetch content:', e));
                
                
            fetch(`/extensions/${this.id}/views/settings_pages.html`)
                .then((res) => res.text())
                .then((text) => {
                    this.settings_pages_content = text;
                    
                    var pages = document.createElement('div');
                    pages.setAttribute('id','extension-power-settings-pages');
                    pages.classList.add('settings-section');
                    pages.classList.add('hidden');
            
                    pages.innerHTML = text;
                    document.body.appendChild(pages);
                    
                    this.create_extra_settings();
                    
                    //setTimeout(() => {
                        
                    //}, 100);
                    
                })
                .catch((e) => {
                    console.error('Failed to fetch settings pages content:', e);
                });
            
            /*
            var pages = document.createElement('div');
            pages.setAttribute('id','extension-power-settings-pages-clone-container');
            pages.innerHTML = 
            const node = document.getElementById("extension-power-settings-pages")
            const clone = node.cloneNode(true);
            console.log("clone: ",clone);
            document.body.appendChild(clone);
            */
            
            
            
            //const settings_menu_element = document.getElementById('settings-menu');
            
            
            
            //console.log("power settings. menu el: ", settings_menu_element);

            
                
        }


        create_extra_settings(){
            
            
            if(document.querySelector('#settings-menu > ul') != null){
                
                const hours = document.getElementById('extension-power-settings-form-hours');
                const minutes = document.getElementById('extension-power-settings-form-minutes');
                const ntp = document.getElementById('extension-power-settings-form-ntp');
                const browser_time_button = document.getElementById('extension-power-settings-form-browser-time-button');
    
                const back_button = document.getElementById('extension-power-settings-back-button');
                console.log("back_button: ", back_button);
                if(back_button == null){
                    console.log("Error, missing power settings back button? Aborting");
                    return;
                }
                
                // Back button
                document.getElementById('extension-power-settings-back-button').addEventListener('click', () => {
                    document.getElementById('extension-power-settings-pages').classList.add('hidden');
                    
                    this.hide_all_settings_containers();
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'unlink_backup_download_dir'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("power settings: back button: unlink response: ", body);
                        }
                    }).catch((e) => {
                       console.log("Error: unlinking download: connection failed: ", e);
                    });
                    
                    
                });
                
                
                // Add buttons to settings menu
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-time-button">Clock</a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-backup-button">Backup</a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-reset-button">Factory reset</a></li>';
                
                 
                
                // Show time page button
                document.getElementById('extension-power-settings-menu-time-button').addEventListener('click', () => {
                    //console.log('show time menu button clicked');
            
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-time').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                });
                
                // Show backup page button
                document.getElementById('extension-power-settings-menu-backup-button').addEventListener('click', () => {
                    //console.log('show backup menu button clicked');
            
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-backup').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'backup_init'
                        }
                    ).then((body) => {
                        console.log("backup init response: ", body);
                        
                    }).catch((e) => {
                        alert("Error: backup could not connect to controller: ", e);
                    });
                    
                });
                
                // Show reset page button
                document.getElementById('extension-power-settings-menu-reset-button').addEventListener('click', () => {
                    //console.log('show reset menu button clicked');
            
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-reset').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                });
                
                
                
                
    
    
                
                
                // FACTORY RESET
    
                document.getElementById('extension-power-settings-form-reset-submit').addEventListener('click', () => {
                    //console.log("factory reset button clicked");
        
                    var keep_z2m = false;
                    try{
                        keep_z2m = document.getElementById('extension-power-settings-keep-z2m').checked;
                        //console.log("keep_z2m: ", keep_z2m);
                    }
                    catch(e){
                        console.log('Error getting keep_z2m value: ', e);
                    }
                    
                    var keep_bluetooth = false;
                    try{
                        keep_bluetooth = document.getElementById('extension-power-settings-keep-bluetooth').checked;
                    }
                    catch(e){
                        console.log('Error getting keep_bluetooth value: ', e);
                    }
        
                    if( document.getElementById('extension-power-settings-form-understand').value != 'I understand'){
                        alert("You must type 'I understand' before the factory reset process may start");
                    }
                    else{
                        if(confirm("Are you absolutely sure?")){
                            document.getElementById('extension-power-settings-container-reset').innerHTML = "<h1>Factory reset in progress</h1><p>The controller will now reboot. When all data is erased the controller will shut down.</p><p>Do not unplug the controller until the red light has stopped blinking (if you do not see it, just wait one minute).</p>";
                            document.getElementById('extension-power-settings-back-button').style.display = 'none';

                            window.API.postJson(
                                `/extensions/${this.id}/api/ajax`, {
                                    'action': 'reset',
                                    'keep_z2m': keep_z2m,
                                    'keep_bluetooth': keep_bluetooth
                                }
                            ).then((body) => {
                                console.log("factory reset response: ", body);
                                if(this.debug){
                                    if(confirm("The system will now reboot")){
                                        if(body.state == 'ok'){
                                            API.setSshStatus(false).then(() => {
                                                window.API.postJson('/settings/system/actions', {
                                                    action: 'restartSystem'
                                                }).catch(console.error);
                                            }).catch((e) => {
                                                console.error(`Failed to toggle SSH: ${e}`);
                                            });
                                        }
                                        else{
                                            alert("Something went wrong! Try rebooting manually and see what happens.");
                                        }
                                    }
                                }
                                else{
                                    if(body.state == 'ok'){
                                        API.setSshStatus(false).then(() => {
                                            window.API.postJson('/settings/system/actions', {
                                                action: 'restartSystem'
                                            }).catch(console.error);
                                        }).catch((e) => {
                                            console.error(`Failed to toggle SSH: ${e}`);
                                        });
                                    }
                                    else{
                                        alert("Something went wrong! Try rebooting manually and see what happens.");
                                    }
                                }
                                
                    
                            }).catch((e) => {
                                alert("Error while attempting to start factory reset: could not connect?: ", e);
                            });
                
                
                        }
                    }
        
                    document.getElementById('extension-power-settings-container-reset').style.display = 'block';
                    // document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'none';
                });
    
    
    
    
    
                // TIME CLOCK
    
                
                ntp.addEventListener('click', () => {
                    var ntp_current_state = 0;
                    if (ntp.checked) {
                        ntp_current_state = 1;
                    }
                    window.API.postJson(
                        `/extensions/${this.id}/api/set-ntp`, {
                            'ntp': ntp_current_state
                        }
                    ).then((body) => {
                        pre.innerText = JSON.stringify(body, null, 2);
                    }).catch((e) => {
                        console.log("set ntp error: ", e);
                    });
                });

                // Submits the manual time
                document.getElementById('extension-power-settings-form-submit-time').addEventListener('click', () => {
                    if (hours.value.trim() != '' && minutes.value.trim() != '') { // Make sure the user inputted something. Python will also sanitize.
                        window.API.postJson(
                            `/extensions/${this.id}/api/set-time`, {
                                'hours': hours.value,
                                'minutes': minutes.value
                            }
                        ).then((body) => {
                            //pre.innerText = JSON.stringify(body, null, 2);
                            document.getElementById('extension-power-settings-container-time').style.display = 'none';
                            //document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'inline-block';
                        }).catch((e) => {
                            console.log("time submit error: ", e);
                            alert("Saving failed: could not connect to the controller")
                        });
                    }
                });
                
                // get current time from browser
                browser_time_button.addEventListener('click', () => {
                    var powerSettingsCurrentTime = new Date();
                    //var powerSettingsTime = powerSettingsCurrentTime.getTime();
                    //powerSettingsCurrentTime.setTime( powerSettingsCurrentTime.getTime() + new Date().getTimezoneOffset()*60*1000 );
                    //console.log(powerSettingsCurrentTime);
                    hours.value = powerSettingsCurrentTime.getHours();
                    minutes.value = powerSettingsCurrentTime.getMinutes();
                });


                //console.log("doing init");
                // Get the server time
                window.API.postJson(
                    `/extensions/${this.id}/api/init`, {
                        'init': 1
                    }
                ).then((body) => {
                    
                    if(typeof body.debug != 'undefined'){
                        this.debug = body.debug;
                        if(body.debug == true){
                            console.log('power settings: init response: ', body);
                        }
                    }
                    
                    hours.placeholder = body['hours'];
                    minutes.placeholder = body['minutes'];
                    ntp.checked = body['ntp'];
                    
                    //console.log("adding mqtt item");
                    // Add MQTT checkbox
                    var mqtt_element = document.createElement('li');
                    mqtt_element.setAttribute('id','allow-anonymous-mqtt-item');
                    mqtt_element.setAttribute('class','developer-checkbox-item');
                    document.querySelector('#developer-settings > ul').prepend(mqtt_element);
                    
                    var mqtt_checked = "";
                    if(body.allow_anonymous_mqtt){
                        mqtt_checked = "checked";
                    }
                    
                    document.getElementById('allow-anonymous-mqtt-item').innerHTML = '<input id="allow-anonymous-mqtt-checkbox" class="developer-checkbox" type="checkbox" '  + mqtt_checked + '> <label for="allow-anonymous-mqtt-checkbox" title="This can pose a security risk, so only enable this if you really need to.">Allow anonymous MQTT</label>';
               
                    document.getElementById('allow-anonymous-mqtt-checkbox').addEventListener('change', () => {
                        console.log('allow anonymous MQTT checkbox value changed');
                    
                        const checkbox_state = document.getElementById('allow-anonymous-mqtt-checkbox').checked;
                        window.API.postJson(
                            `/extensions/${this.id}/api/ajax`, {
                                'action': 'anonymous_mqtt','allow_anonymous_mqtt': checkbox_state
                            }
                        ).then((body) => {
                            if(this.debug){
                                console.log("allow_anonymous MQTT response: ", body);
                            }                                    
                        
                        }).catch((e) => {
                            alert("Error, allow_anonymous MQTT setting was not changed: could not connect to controller: ", e);
                        });
                    });
                    
                    
                    
                    
                }).catch((e) => {
                    console.log("powersettings init error: ", e);
                });
                
                
                
                
                // BACKUP
                
                document.getElementById('extension-power-settings-create-backup-button').addEventListener('click', () => {
                    //console.log("create backup button clicked");
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'create_backup'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("create backup response: ", body);
                        }
                        if(body.state == 'ok'){
                            window.location.pathname = "/extensions/power-settings/backup/candle_backup.tar";
                        }
                        else{
                             alert("Sorry, an error occured while creating the backup");
                        }
                        
                    }).catch((e) => {
                        alert("Error, could not create backup: could not connect?: ", e);
                    });
                    
                });
                
                
                // Upload
                
    			document.getElementById("extension-power-settings-backup-file-selector").addEventListener('change', () => {
    				var filesSelected = document.getElementById("extension-power-settings-backup-file-selector").files;
    				
                    document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<div class="extension-power-settings-spinner"><div></div><div></div><div></div><div></div></div>';
                    this.upload_files(filesSelected);
    			});
                
                
                
            }
            else{
                console.log("power settings error: settings menu didn't exist yet, so cannot append additional elements");
            }
        }

        show() {
            if (this.content == '') {
                return;
            }
            this.view.innerHTML = this.content;
            

            const pre = document.getElementById('extension-power-settings-response-data');
            const content = document.getElementById('extension-power-settings-content');

            const shutdown = document.getElementById('extension-power-settings-shutdown');
            const reboot = document.getElementById('extension-power-settings-reboot');
            const restart = document.getElementById('extension-power-settings-restart');

            const content_container = document.getElementById('extension-power-settings-content-container');
            
            const waiting = document.getElementById('extension-power-settings-waiting');
            const waiting_message = document.getElementById('extension-power-settings-waiting-message');

            pre.innerText = "";

            
            // Switch full screen
            document.getElementById('extension-power-settings-fullscreen-button').addEventListener('click', () => {

                var elem = document.documentElement;
                if (!document.fullscreenElement && !document.mozFullScreenElement &&
                    !document.webkitFullscreenElement && !document.msFullscreenElement) {
                    if (elem.requestFullscreen) {
                        elem.requestFullscreen();
                    } else if (elem.msRequestFullscreen) {
                        elem.msRequestFullscreen();
                    } else if (elem.mozRequestFullScreen) {
                        elem.mozRequestFullScreen();
                    } else if (elem.webkitRequestFullscreen) {
                        elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.msExitFullscreen) {
                        document.msExitFullscreen();
                    } else if (document.mozCancelFullScreen) {
                        document.mozCancelFullScreen();
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                }

            });

            shutdown.addEventListener('click', () => {
                content_container.style.display = 'none';
                waiting.style.display = 'block';
                waiting_message.innerHTML = '<h2>Shutting down...</h2><p>Please wait at least 15 seconds before unplugging the controller.</p>';
                window.API.postJson(
                    `/extensions/${this.id}/api/shutdown`, {}
                )
            });

            reboot.addEventListener('click', () => {
                content_container.style.display = 'none';
                waiting.style.display = 'block';
                waiting_message.innerHTML = '<h2>Rebooting...</h2><p>This should take a minute or two.</p>';
                window.API.postJson('/settings/system/actions', {
                    action: 'restartSystem'
                }).catch(console.error);


                this.check_if_back();
                //window.API.postJson(
                //  `/extensions/${this.id}/api/reboot`,
                //  {}
                //)
            });

            restart.addEventListener('click', () => {
                content_container.style.display = 'none';
                waiting.style.display = 'block';
                waiting_message.innerHTML = '<h2>Restarting...</h2><p>The controller software is being restarted.</p>';
                window.API.postJson(
                    `/extensions/${this.id}/api/restart`, {}
                )
                
                this.check_if_back();
                
            });
            
            
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'get_stats'
                }
            ).then((body) => {
                console.log("get stats response: ", body);
                if(this.debug){
                    console.log("get stats response: ", body);
                }                      
                // Show the available memory. This is different from "free" memory
                if(typeof body['available_memory'] != 'undefined'){
                    document.getElementById('extension-power-settings-available-memory').innerText = body['available_memory'];
                }
                // Show the total memory
                if(typeof body['total_memory'] != 'undefined'){
                    document.getElementById('extension-power-settings-total-memory').innerText = body['total_memory'];
                }  
            
            }).catch((e) => {
                alert("Error, allow_anonymous MQTT setting was not changed: could not connect to controller: ", e);
            });
            
            
            /*
            // Show the time settings
            document.getElementById('extension-power-settings-show-time-settings-button').addEventListener('click', () => {
                //console.log("time button clicked");
                this.hide_all_settings_containers();
                document.getElementById('extension-power-settings-container-time').style.display = 'block';
                //document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'none';
            });
            
            // Show the factory reset settings
            document.getElementById('extension-power-settings-show-reset-settings-button').addEventListener('click', () => {
                //console.log("reset button clicked");
                this.hide_all_settings_containers();
                document.getElementById('extension-power-settings-container-reset').style.display = 'block';
               // document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'none';
            });
            */
            
        }
        
        /*
        check_for_usb_stick(){
            //console.log("in check_for_usb_stick");
            setTimeout(() => {
                
                window.API.postJson(
                    `/extensions/${this.id}/api/init`, {
                        'init': 1
                    }
                ).then((body) => {
                    //hours.placeholder = body['hours'];
                    //minutes.placeholder = body['minutes'];
                    //ntp.checked = body['ntp'];
                    //console.log('The controller seems to be back');

                    //location.replace(baseUrl);
                    window.location.href = this.baseUrl;
                }).catch((e) => {
                    //console.log("not back yet");
                    this.check_if_back(); // the cycle continues
                });
                


            }, 5000);
        }
        */
        
        check_if_back(){
            //console.log("in check if back");
            setTimeout(() => {
                
                window.API.postJson(
                    `/extensions/${this.id}/api/init`, {
                        'init': 1
                    }
                ).then((body) => {
                    //hours.placeholder = body['hours'];
                    //minutes.placeholder = body['minutes'];
                    //ntp.checked = body['ntp'];
                    //console.log('The controller seems to be back');

                    //location.replace(baseUrl);
                    window.location.href = this.baseUrl;
                }).catch((e) => {
                    //console.log("not back yet");
                    this.check_if_back(); // the cycle continues
                });
                


            }, 5000);
        }
        
        
        
        hide_all_settings_containers(){
            document.getElementById('extension-power-settings-pages').classList.add('hidden');
            document.querySelectorAll('.extension-power-settings-container').forEach( el => {
                el.classList.add('extension-power-settings-hidden');
            });
        }
        
        
        
    	upload_files(files){
    		if (files && files[0]) {
			    
                /*
                function blobToBase64(blob) {
                  return new Promise((resolve, _) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                  });
                }
                */
                
    			var filename = files[0]['name'].replace(/[^a-zA-Z0-9\.]/gi, '_').toLowerCase(); //.replace(/\s/g , "_");
                var filetype = files[0].type;
                //console.log("filename and type: ", filename, filetype);
                    
                /*
                var reader = new FileReader();
                reader.readAsDataURL(blob); 
                reader.onloadend = function() {
                    var base64data = reader.result;                
                    console.log(base64data);
                }
                */
                    
                //console.log("this1: ", this);
    		    var reader = new FileReader();

    		    reader.addEventListener("load", (e) => {
                    //console.log('reader loaded');
			        var finalFile = reader.result;
                    
                    finalFile = finalFile.substring(finalFile.indexOf(',') + 1);
			        //console.log(finalFile);
                    
                    window.API.postJson(
      		        	`/extensions/power-settings/api/save`,
                        {'action':'upload', 'filename':filename, 'filedata': finalFile, 'parts_total':1, 'parts_current':1} //e.target.result

      			      ).then((body) => {
                            console.log("saving restore file result: ", body);
                            
                            if(body.state == 'ok'){
                                if(confirm("The system must now reboot to finish restoring the backup")){
                                    window.API.postJson('/settings/system/actions', {
                                        action: 'restartSystem'
                                    }).catch(console.error);
                                    document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<p>Rebooting...</p>';
                                }
                                else{
                                    document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<p>Please reboot the controller to complete the restore process.</p>';
                                }
                            }
                            else{
                                document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML =  '<p>An error occured while handling the uploaded file.</p>';
                            }

      			      }).catch((e) => {
      					    console.log("Error uploading file: ", e);
                            document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<p>Error, could not upload the file. It could just be a connection issue. Or perhaps the file is too big (maximum size is 10Mb).</p>';    
      			      });
                    
    		    }); 

    		    reader.readAsDataURL( files[0] );
    	  	}
    	}
        
        
    }

    new PowerSettings();

})();