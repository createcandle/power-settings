(function() {
    class PowerSettings extends window.Extension {
        constructor() {
            super('power-settings');
            this.addMenuEntry('Power settings');

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
        }

        show() {
            if (this.content == '') {
                return;
            }
            this.view.innerHTML = this.content;

            const hours = document.getElementById('extension-power-settings-form-hours');
            const minutes = document.getElementById('extension-power-settings-form-minutes');
            const ntp = document.getElementById('extension-power-settings-form-ntp');
            const browser_time_button = document.getElementById('extension-power-settings-form-browser-time-button');

            const pre = document.getElementById('extension-power-settings-response-data');
            const content = document.getElementById('extension-power-settings-content');

            const shutdown = document.getElementById('extension-power-settings-shutdown');
            const reboot = document.getElementById('extension-power-settings-reboot');
            const restart = document.getElementById('extension-power-settings-restart');

            const content_container = document.getElementById('extension-power-settings-content-container');
            
            const waiting = document.getElementById('extension-power-settings-waiting');
            const waiting_message = document.getElementById('extension-power-settings-waiting-message');

            pre.innerText = "";

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
                    pre.innerText = e.toString();
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
                        pre.innerText = JSON.stringify(body, null, 2);
                        document.getElementById('extension-power-settings-container-time').style.display = 'none';
                        document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'inline-block';
                    }).catch((e) => {
                        pre.innerText = e.toString();
                        alert("Saving failed: could not connect to the controller")
                    });
                }
            });


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

            // Show the time settings
            document.getElementById('extension-power-settings-show-time-settings-button').addEventListener('click', () => {
                //console.log("clock button clicked");
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
            
            
            document.getElementById('extension-power-settings-form-reset-submit').addEventListener('click', () => {
                //console.log("factory reset button clicked");
                
                var keep_z2m = true;
                try{
                    keep_z2m = document.getElementById('extension-power-settings-keep-z2m').checked;
                    //console.log("keep_z2m: ", keep_z2m);
                }
                catch(e){
                    //console.log('Error getting keep_z2m value: ', e);
                }
                
                if( document.getElementById('extension-power-settings-form-understand').value != 'I understand'){
                    alert("You must type 'I understand' before the factory reset process may start");
                }
                else{
                    if(confirm("Are you absolutely sure?")){
                        document.getElementById('extension-power-settings-container-reset').innerHTML = "<h1>One moment</h1><p>When all data is erased the controller will shut down.</p><p>Do not unplug the controller until the red light has stopped blinking (if you do not see it, just wait one minute).</p>";
                        
                        API.setSshStatus(false).then(() => {
                            
                            window.API.postJson(
                                `/extensions/${this.id}/api/ajax`, {
                                    'action': 'reset',
                                    'keep_z2m': keep_z2m
                                }
                            ).then((body) => {
                                //console.log(body);
                            }).catch((e) => {
                                //alert("Error: could not connect");
                            });
                            
                        }).catch((e) => {
                            console.error(`Failed to toggle SSH: ${e}`);
                        });
                        
                        
                    }
                }
                
                document.getElementById('extension-power-settings-container-reset').style.display = 'block';
               // document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'none';
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

            //console.log("Initing power settings");
            //console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)
            // Get the server time
            window.API.postJson(
                `/extensions/${this.id}/api/init`, {
                    'init': 1
                }
            ).then((body) => {
                hours.placeholder = body['hours'];
                minutes.placeholder = body['minutes'];
                ntp.checked = body['ntp'];
            }).catch((e) => {
                pre.innerText = e.toString();
            });

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
            document.querySelectorAll('.extension-power-settings-container').forEach( el => {
                el.style.display = "none";
            });
        }
        
    }

    new PowerSettings();

})();