(function() {
    class PowerSettings extends window.Extension {
        constructor() {
            super('power-settings');
            
            //this.addMenuEntry('Power');
            
            this.interval = null;
            
            document.querySelector('#main-menu> ul').insertAdjacentHTML('beforeend', '<li id="extension-power-settings-menu-item-li"><a id="extension-power-settings-menu-item" href="/extensions/power-settings">Power</a></li>');
            
            //console.log(window.API);

            this.debug = false;
			this.second_init_attempted = false;
			
            this.kiosk = false;
            this.exhibit_mode = false;
            
            this.bits = "UNKNOWN";
            this.update_available_text = "";
            this.system_update_in_progress = false;
            this.recovery_partition_exists = false;
            this.overlay_exists = true;

            this.interval = null;
            this.recovery_interval = null;
            
            this.total_memory = 0;
            this.user_partition_free_disk_space = 0;
            this.log_size = 0;
            this.photos_size = 0;
            this.uploads_size = 0;

            const getUrl = window.location;
            this.baseUrl = getUrl.protocol + "//" + getUrl.host + "/things";

			
			this.display_port1_name = 'HDMI-1';
			this.display_port2_name = 'HDMI-2';

			this.printing_allowed = false;
			this.connected_printers = {};
			
			this.attached_devices = [];

			this.get_stats_interval = null;
			this.get_stats_fail_counter = 0;

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


        // Mostly adds event listeners once settings_page.html has loaded in
        create_extra_settings(){
            
            
            if(document.querySelector('#settings-menu > ul') != null){
                
                const hours = document.getElementById('extension-power-settings-form-hours');
                const minutes = document.getElementById('extension-power-settings-form-minutes');
                const ntp = document.getElementById('extension-power-settings-form-ntp');
                const browser_time_button = document.getElementById('extension-power-settings-form-browser-time-button');
    
                const back_button = document.getElementById('extension-power-settings-back-button');
                
                if(back_button == null){
                    console.error("Error, missing power settings back button? Aborting");
                    return;
                }
                
				
				
                
                // Kiosk?
                if(document.getElementById('virtualKeyboardChromeExtension') != null){
                    document.body.classList.add('kiosk');
                    this.kiosk = true;
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
                            console.log("power settings: unlink_backup_download_dir response: ", body);
                        }
                    }).catch((e) => {
                       console.error("Error: unlink_backup_download_dir connection failed: ", e);
                    });
                    
                });
                
                
                // Add buttons to settings menu
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-time-button">Clock</a></li>';
				document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-display-button">Display</a></li>';
				document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item" id="extension-power-settings-main-menu-printer-item" style="display:none"><a id="extension-power-settings-menu-printer-button">Printer</a></li>';
				document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-system-button">System Information</a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-backup-button">Backup & Restore</a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-update-button">Update <span id="extension-power-settings-menu-update-button-indicator">' + this.update_available_text + '</span></a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item"><a id="extension-power-settings-menu-reset-button">Factory reset</a></li>';
                
                
                
                // Show time page button
                document.getElementById('extension-power-settings-menu-time-button').addEventListener('click', () => {
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-time').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                    
                    this.show_clock_page();
                    
                });
				
				
                // Show display page button
                document.getElementById('extension-power-settings-menu-display-button').addEventListener('click', () => {
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-display').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                    
                    this.show_display_page();
                    
                });
				
				
                // Show printer page button
                document.getElementById('extension-power-settings-menu-printer-button').addEventListener('click', () => {
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-printer').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                    
                    this.show_printer_page();
                    
                });
				
				// printer page checkbox listeners
				
				
				
				document.getElementById('extension-power-settings-allow-printing-checkbox').addEventListener('change', () => {
		            this.printing_allowed = document.getElementById('extension-power-settings-allow-printing-checkbox').checked;
					
					const printer_list_el = document.getElementById('extension-power-settings-printers-list-container');
					
					if (this.printing_allowed){
						printer_list_el.innerHTML = '<div class="extension-power-settings-spinner"><div></div><div></div><div></div><div></div></div>';
						document.body.classList.add('cups-printing');
					}
					else{
						document.body.classList.remove('cups-printing');
						printer_list_el.innerHTML = '<p>Network printing is disabled</p>';
						this.connected_printers = {};
					}
					
					window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'printer',
							'printing_allowed':this.printing_allowed
		                }
		            ).then((body) => {
		                if(this.debug){
		                    console.log("printer change printing_allowed response: ", body);
		                }
				
						if(this.printing_allowed && typeof body.connected_printers != 'undefined'){
							this.connected_printers = body.connected_printers;
							this.generate_connected_printers_list();
						}
						
		            }).catch((e) => {
		                console.log("Error, changing printing_allowed setting (connection) error: ", e);
		            });
				});
				
				
				
				
				
				
				// Display settings checkbox listeners
				
				document.getElementById('extension-power-settings-rpi-display-rotate-checkbox').addEventListener('change', () => {
		            let rpi_display_rotation = 0;
					if(document.getElementById('extension-power-settings-rpi-display-rotate-checkbox').checked){
						rpi_display_rotation = 180;
					}
					
					window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_rpi_display_rotation',
							'rpi_display_rotation': rpi_display_rotation
		                }
		            ).then((body) => {
		                if(this.debug){
		                    console.log("set_rpi_display_rotation response: ", body);
		                }
		            }).catch((e) => {
		                console.error("Error sending rpi display rotation command: ", e);
		            });
				});
				
				
				// Rotate checkbox for display 1
	            document.getElementById("extension-power-settings-display1-rotate-checkbox").addEventListener('change', () => {
	                //console.log("display1 rotation changed");
					//document.getElementById("extension-power-settings-low-storage-warning").style.display = 'none';
	                //document.getElementById("extension-power-settings-expand-user-partition-explanation").style.display = 'block';
		            let display1_rotation = 0;
					if(document.getElementById("extension-power-settings-display1-rotate-checkbox").checked){
						display1_rotation = 180;
					}
		            let display2_rotation = 0;
					if(document.getElementById("extension-power-settings-display2-rotate-checkbox").checked){
						display2_rotation = 180;
					}
					
					window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_display_rotation',
							'display1_rotation': display1_rotation,
							'display2_rotation': display2_rotation
		                }
		            ).then((body) => {
		                if(this.debug){
		                    console.log("set_display_rotation response: ", body);
		                }
		            }).catch((e) => {
		                console.error("Error sending display rotation command: ", e);
		            });
	            });
				
				// Rotate checkbox for display 2
	            document.getElementById("extension-power-settings-display2-rotate-checkbox").addEventListener('change', () => {
	                //console.log("display1 rotation changed");
					//document.getElementById("extension-power-settings-low-storage-warning").style.display = 'none';
	                //document.getElementById("extension-power-settings-expand-user-partition-explanation").style.display = 'block';
		            let display1_rotation = 0;
					if(document.getElementById("extension-power-settings-display1-rotate-checkbox").checked){
						display1_rotation = 180;
					}
		            let display2_rotation = 0;
					if(document.getElementById("extension-power-settings-display2-rotate-checkbox").checked){
						display2_rotation = 180;
					}
					
					window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_display_rotation',
							'display1_rotation': display1_rotation,
							'display2_rotation': display2_rotation
		                }
		            ).then((body) => {
		                if(this.debug){
		                    console.log("set_display_rotation response: ", body);
		                }
		            }).catch((e) => {
		                console.error("Error sending display rotation command: ", e);
		            });
	            });
				
				// power management checkbox for display 1
	            document.getElementById("extension-power-settings-display1-power-checkbox").addEventListener('change', () => {
	                //console.log("display1 rotation changed");
					//document.getElementById("extension-power-settings-low-storage-warning").style.display = 'none';
	                //document.getElementById("extension-power-settings-expand-user-partition-explanation").style.display = 'block';
		            let display1_power = document.getElementById("extension-power-settings-display1-power-checkbox").checked;
		            let display2_power = document.getElementById("extension-power-settings-display2-power-checkbox").checked;
					window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_display_power',
							'display1_power': display1_power,
							'display2_power': display2_power
		                }
		            ).then((body) => {
		                if(this.debug){
		                    console.log("set_display_power response: ", body);
		                }
		            }).catch((e) => {
		                console.error("Error sending display power command: ", e);
		            });
	            });
				
				// power management checkbox for display 2
	            document.getElementById("extension-power-settings-display2-power-checkbox").addEventListener('change', () => {
	                //console.log("display1 rotation changed");
					//document.getElementById("extension-power-settings-low-storage-warning").style.display = 'none';
	                //document.getElementById("extension-power-settings-expand-user-partition-explanation").style.display = 'block';
		            let display1_power = document.getElementById("extension-power-settings-display1-power-checkbox").checked;
		            let display2_power = document.getElementById("extension-power-settings-display2-power-checkbox").checked;
					window.API.postJson(
		                `/extensions/${this.id}/api/ajax`, {
		                    'action': 'set_display_power',
							'display1_power': display1_power,
							'display2_power': display2_power
		                }
		            ).then((body) => {
		                if(this.debug){
		                    console.log("set_display_power response: ", body);
		                }
		            }).catch((e) => {
		                console.error("Error sending display power command: ", e);
		            });
	            });
				
				
                
                // Show System Details page button
                document.getElementById('extension-power-settings-menu-system-button').addEventListener('click', () => {
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-system').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
					this.get_stats();
					
					if(this.get_stats_interval != null){
						window.clearInterval(this.get_stats_interval);
					}
	                this.get_stats_interval = setInterval(() => {
						if(this.get_stats_fail_counter <= 0){
			                if(this.debug){
			                    console.log("power settings: get_stats_interval: calling get_stats");
			                }
							this.get_stats();
						}
						else{
			                if(this.debug){
			                    console.log("power settings: get_stats failed, counting down to retry: ", this.get_stats_fail_counter);
			                }
							this.get_stats_fail_counter--;
						}
	                    
	                }, 6000);
					
				});
				
	            // START PARTITION EXPANSION
	            document.getElementById("extension-power-settings-user-partition-expansion-button").addEventListener('click', () => {
	                //document.getElementById("extension-power-settings-low-storage-warning").style.display = 'none';
	                //document.getElementById("extension-power-settings-expand-user-partition-explanation").style.display = 'block';
					if(confirm("Are you sure you want to expand to the full size of the SD card?")){
						this.start_partition_expansion();
					}
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
                        if(this.debug){
                            console.log("backup init response: ", body);
                        }
                        
                        if(typeof body.log_size != 'undefined'){
                            this.log_size = body.log_size;
                            document.getElementById('extension-power-settings-log-size').innerText = Math.round(this.log_size / 1000000);
                        }
                        if(typeof body.photos_size != 'undefined'){
                            this.photos_size = body.photos_size;
                            document.getElementById('extension-power-settings-photos-size').innerText = Math.round(this.photos_size / 1000000);
                        }
                        if(typeof body.uploads_size != 'undefined'){
                            this.uploads_size = body.uploads_size;
                            document.getElementById('extension-power-settings-uploads-size').innerText = Math.round(this.uploads_size / 1000000);
                        }
                        
                        if(typeof body.photo_frame_installed != 'undefined'){
                            if(body.photo_frame_installed){
                                document.getElementById('extension-power-settings-container-backup').classList.add('extension-power-settings-photo-frame-installed');
                            }
                            else{
                                document.getElementById('extension-power-settings-container-backup').classList.remove('extension-power-settings-photo-frame-installed');
                            }
                        }
                        
                    }).catch((e) => {
                        console.error("Error: backup init could not connect to controller: ", e);
                    });
                    
                });
                
                
                // Show factory reset page button
                document.getElementById('extension-power-settings-menu-reset-button').addEventListener('click', () => {
                    //console.log('show reset menu button clicked');
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-reset').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                });
                
                
                
                // Show update page button
                document.getElementById('extension-power-settings-menu-update-button').addEventListener('click', () => {
                    //console.log('show reset menu button clicked');
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-update').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                    
                    this.update_checks();
                });
                
                // Force-reveal the recovery update options, for developers
                document.getElementById('extension-power-settings-force-reveal-recovery-update-button').addEventListener('click', () => {
                    console.log('force show recovery update options button clicked');
                    document.getElementById('extension-power-settings-update-recovery-container').classList.add('extension-power-settings-developer-only');
                    document.getElementById('extension-power-settings-switch-to-recovery-container').classList.add('extension-power-settings-developer-only');
                });
                
                
                // Ethernet check button
                if( document.getElementById('extension-power-settings-pages-update-ethernet-retest-button') != null){
                    document.getElementById('extension-power-settings-pages-update-ethernet-retest-button').addEventListener('click', () => {
                        this.update_checks();
                    });
                }
                else{
                    console.error("power settings: extension-power-settings-pages-update-ethernet-retest-button does not exist yet? cannot attach listener");
                }
                
                
                // Expand user partition button
                /*
                document.getElementById('extension-power-settings-expand-user-partition-button').addEventListener('click', () => {
                    console.log('expand user partition button clicked');
                    document.getElementById('extension-power-settings-expand-user-partition-button').style.display = 'none';
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'expand_user_partition'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("expand_user_partition response: ", body);
                        }
                    }).catch((e) => {
                        console.error("Error: expand_user_partition could not connect to controller: ", e);
                    });
                    
                });
                */
                
                
                
                // FACTORY RESET
    
                document.getElementById('extension-power-settings-form-reset-submit').addEventListener('click', () => {
                    //console.log("factory reset button clicked");
        
                    var keep_z2m = false;
                    try{
                        keep_z2m = document.getElementById('extension-power-settings-keep-z2m').checked;
                        console.log("keep_z2m: ", keep_z2m);
                    }
                    catch(e){
                        console.log('Error getting keep_z2m value: ', e);
                    }
                    
                    var keep_bluetooth = false;
                    try{
                        keep_bluetooth = document.getElementById('extension-power-settings-keep-bluetooth').checked;
                        console.log("keep_bluetooth: ", keep_bluetooth);
                    }
                    catch(e){
                        console.log('Error getting keep_bluetooth value: ', e);
                    }
        
                    if( document.getElementById('extension-power-settings-factory-reset-understand').value != 'I understand'){
                        alert("You must type 'I understand' before the factory reset process can start.");
                    }
                    else{
                        
                        document.getElementById('extension-power-settings-container-reset').innerHTML = "<h1>Factory reset in progress</h1><p>The controller will now reboot. When all data is erased the controller will shut down.</p><p>Do not unplug the controller until the red light has stopped blinking (if you do not see it, just wait 5 minutes).</p>";
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
                            alert("Error while attempting to start factory reset: could not connect?");
                        });
                
                    }
        
                    document.getElementById('extension-power-settings-container-reset').style.display = 'block';
                    // document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'none';
                });
    
    
    
                // START RECOVERY UPGRADE
                
                document.getElementById('extension-power-settings-update-recovery-button').addEventListener('click', () => {
                    if(this.debug){
                        console.log("update recovery button clicked");
                    }
                    
                    document.getElementById('extension-power-settings-system-update-button').style.display = 'none';
                    document.getElementById('extension-power-settings-update-recovery-button').style.display = 'none';
                    document.getElementById('extension-power-settings-update-recovery-failed').style.display = 'none';
                    
                    document.getElementById('extension-power-settings-update-recovery-busy').style.display = 'block';
                    document.getElementById('extension-power-settings-update-recovery-busy-progress').style.width = '0%';
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'update_recovery_partition'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("update_recovery_partition update response: ", body);
                        }
                        
                        this.start_recovery_poll();
                        /*
                        if(body.state == 'ok'){ // currently hardcoded to return 'ok'
                            console.log("updating recovery partition succeeded");
                        }
                        else{
                            console.log("update recovery response was NOT ok");
                        }
                        */
                    }).catch((e) => {
                        console.error("Error starting update of recovery partition: ", e);
                    });
                    
                });
    
    
    
                // MANUAL UPDATE
                // This only runs apt-get upgrade
    
                document.getElementById('extension-power-settings-manual-update-button').addEventListener('click', () => {
                    if(this.debug){
                        console.log("manual update button clicked");
                    }
        
                    document.getElementById('extension-power-settings-system-update-container').style.display = 'none';

                    document.getElementById('connectivity-scrim').classList.remove('hidden');
                    document.getElementById('extension-power-settings-back-button').style.display = 'none';
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'manual_update'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("manual update response: ", body);
                        }
                        
                        if(body.state == 'ok'){
                            window.API.postJson('/settings/system/actions', {
                                action: 'restartSystem'
                            }).catch(console.error);
                        }
                        else{
                            alert("Error, could not prepare sytem for manual update! Try rebooting and see what happens.");
                            document.getElementById('extension-power-settings-back-button').style.display = 'block';
                            document.getElementById('connectivity-scrim').classList.add('hidden');
                        }
            
                    }).catch((e) => {
                        alert("Error while attempting to start manual update: could not connect?");
                        document.getElementById('extension-power-settings-back-button').style.display = 'block';
                        document.getElementById('connectivity-scrim').classList.add('hidden');
                    });
                });
    
    
                // MANUAL SYSTEM UPDATE TO CUTTING EDGE VIA SCRIPT
                /*
                document.getElementById('extension-power-settings-force-update-to-cutting-edge-button').addEventListener('click', () => {
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'start_system_update', 'cutting_edge':true, 'live_update':false
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("start update to cutting edge response: ", body);
                        }
                        if (body.state == false){
                            document.getElementById('extension-power-settings-update-progress-container').style.display = 'none';
                            alert("Starting the update seems to have failed");
                        }
                        else{
                            this.overlay_exists = false;
                            document.getElementById('extension-power-settings-system-update-available-container').style.display = 'none';
                            document.getElementById('extension-power-settings-update-progress-container').style.display = 'block';
                        }
        
                    }).catch((e) => {
                        console.error("Error, could not start system cutting edge update: could not connect to controller: ", e);
                    });
                });
                */
                
    
    
    
    
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
                        if(this.debug){
                            console.log("set NTP response: ", body);
                        }
                        
                        if(ntp_current_state == 0){
                            document.getElementById('extension-power-settings-manually-set-time-container').style.display = 'block';
                        }
                        else{
                            document.getElementById('extension-power-settings-manually-set-time-container').style.display = 'none';
                        }
                        
                    }).catch((e) => {
                        console.error("set ntp error: ", e);
                    });
                });
                
                
                // Sync time with internet when using hardware clock
                document.getElementById('extension-power-settings-hardware-clock-sync-button').addEventListener('click', () => {
                    document.getElementById('extension-power-settings-hardware-clock-sync-button').style.display = 'none';
                    setTimeout(function(){
                        document.getElementById('extension-power-settings-hardware-clock-sync-button').style.display = 'block';
                    }, 5000);
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'sync_time'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("sync-time response: ", body);
                        }
                    }).catch((e) => {
                        console.error("sync time error: ", e);
                    });
                
                });

                // Submits the manual time
                document.getElementById('extension-power-settings-form-submit-time').addEventListener('click', () => {
                    //console.log("save time button clicked");
                    if (hours.value.trim() != '' && minutes.value.trim() != '') { // Make sure the user inputted something. Python will also sanitize.
                        window.API.postJson(
                            `/extensions/${this.id}/api/set-time`, {
                                'hours': hours.value,
                                'minutes': minutes.value
                            }
                        ).then((body) => {
                            if(this.debug){
                                console.log("set-time response: ", body);
                            }
                            if(body.state == true){
                                //pre.innerText = JSON.stringify(body, null, 2);
                                document.getElementById('extension-power-settings-container-time-manual-done').style.display = 'block';
                                //document.getElementById('extension-power-settings-show-time-settings-button').style.display = 'inline-block';
                            
                                document.getElementById('extension-power-settings-form-hours').value = "";
                                document.getElementById('extension-power-settings-form-hours').placeholder = body.hours;
                                document.getElementById('extension-power-settings-form-minutes').value = "";
                                document.getElementById('extension-power-settings-form-minutes').placeholder = body.minutes;
                            
                                setTimeout(function(){
                                    document.getElementById('extension-power-settings-container-time-manual-done').style.display = 'none';
                                }, 2000);
                            }
                            else{
                                alert("Sorry, something went wrong while setting the time");
                            }
                            this.show_clock_page();
                            
                        }).catch((e) => {
                            console.error("time submit error: ", e);
                            alert("Saving failed: could not connect to the controller");
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

				
                this.get_init();
                
                
                
                
                // BACKUP
                
                // backup more checkbox
                document.getElementById('extension-power-settings-backup-more-checkbox').addEventListener('change', () => {
                    if(this.debug){
                        console.log("backup more checkbox changed");
                    }
                    const total_additional_files_size = this.log_size + this.photos_size + this.uploads_size;
                    if(this.debug){
                        console.log("total_additional_files_size: ", total_additional_files_size);
                    }
                    if(total_additional_files_size > 90000000){
                        document.getElementById('extension-power-settings-backup-more-tip').style.display = 'block';
                    }
                    
                });
                
                document.getElementById('extension-power-settings-create-backup-button').addEventListener('click', () => {
                    //console.log("create backup button clicked");
                    
                    document.getElementById('extension-power-settings-create-backup-button').style.display = 'none';
                    document.getElementById('extension-power-settings-backuping-spinner').style.display = 'block';
                    
                    const backup_more = document.getElementById('extension-power-settings-backup-more-checkbox').checked;
                    if(this.debug){
                        console.log("backup_more: ", backup_more);
                    }
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'create_backup', 'backup_more':backup_more
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("power settings debug: create backup response: ", body);
                        }
                        
                        if(body.state == 'ok'){
                            window.location.pathname = "/extensions/power-settings/backup/candle_backup.tar";
                        }
                        else{
                             alert("Sorry, an error occured while creating the backup");
                        }
                        document.getElementById('extension-power-settings-create-backup-button').style.display = 'block';
                        document.getElementById('extension-power-settings-backuping-spinner').style.display = 'none';
                        
                        if(body.photos_failed == true){
                            document.getElementById('extension-power-settings-backup-more-photos-too-big-tip').style.display = 'block';
                        }
                        if(body.logs_failed == true){
                            document.getElementById('extension-power-settings-backup-more-logs-too-big-tip').style.display = 'block';
                        }
                        
                    }).catch((e) => {
                        alert("Error, could not create backup: could not connect?");
                        document.getElementById('extension-power-settings-create-backup-button').style.display = 'block';
                        document.getElementById('extension-power-settings-backuping-spinner').style.display = 'none';
                    });
                    
                });
                
                
                // Upload
                
    			document.getElementById("extension-power-settings-backup-file-selector").addEventListener('change', () => {
    				var filesSelected = document.getElementById("extension-power-settings-backup-file-selector").files;
                    document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<div id="extension-power-settings-upload-in-progress"><div class="extension-power-settings-spinner"><div></div><div></div><div></div><div></div></div><p>Transferring file</p></div>';
                    this.upload_files(filesSelected);
    			});
                
                
                
                
                // Get the latest time for the clock page
                document.getElementById('extension-power-settings-clock-page-icon').addEventListener('click', () => {
                    this.show_clock_page();
                });
                document.getElementById('extension-power-settings-shell-date').addEventListener('click', () => {
                    this.show_clock_page();
                });
                
                
                
                // Disable overlay button
                document.getElementById('extension-power-settings-system-update-disable-overlay-button').addEventListener('click', () => {
                    //console.log("system update disable overlay button clicked");
                    document.getElementById('extension-power-settings-system-update-disable-overlay-button').style.display = 'none';
                    document.getElementById('extension-power-settings-system-update-disable-overlay-spinner').style.display = 'block';
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'disable_overlay'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("disable_overlay response: ", body);
                        }
                        if(body.state == true){
                            if(this.debug){
                                console.log("OK response, restarting system");
                            }
                            
                            this.start_poll();
                            
                            window.API.postJson('/settings/system/actions', {
                                action: 'restartSystem'
                            }).catch(console.error);
                        }
                        else{
                            document.getElementById('extension-power-settings-system-update-disable-overlay-button').style.display = 'block';
                            document.getElementById('extension-power-settings-system-update-disable-overlay-spinner').style.display = 'none';
                        }
                        
                    }).catch((e) => {
                        document.getElementById('extension-power-settings-system-update-disable-overlay-button').style.display = 'block';
                        document.getElementById('extension-power-settings-system-update-disable-overlay-spinner').style.display = 'none';
                        alert("Error, connection issue");
                    });
                    
                });
                
                
                
                // Start update button
                document.getElementById('extension-power-settings-system-update-button').addEventListener('click', () => {
                    if( document.getElementById('extension-power-settings-system-update-understand').value != 'I understand'){
                        alert("You must type 'I understand' before the system update can start.");
                    }
                    else{
                        this.start_update();
                    }
                });
                
                
                // Force update button. Reveals the system update div regardless of whether a system update is available.
                document.getElementById('extension-power-settings-force-update-button').addEventListener('click', () => {
                    //console.log("force system update button clicked");
                    document.getElementById('extension-power-settings-system-update-available-container').style.display = 'block';
                    //document.getElementById('extension-power-settings-no-updates').style.display = 'none';
                });
                
                
                // Retry update button
                document.getElementById('extension-power-settings-system-update-retry-button').addEventListener('click', () => {
                    this.start_update();
                    document.getElementById('extension-power-settings-system-update-error').style.display = 'none';
                    document.getElementById('extension-power-settings-system-update-available-container').style.display = 'block';
                    document.getElementById('extension-power-settings-no-updates').style.display = 'none';
                });
                
                // Show log button
                document.getElementById('extension-power-settings-system-update-show-log-button').addEventListener('click', () => {
                    document.getElementById('extension-power-settings-update-process-output').classList.remove('extension-power-settings-dev-only');
                });
                
                
                
                
                // Start RECOVERY update button
                document.getElementById('extension-power-settings-switch-to-recovery-button').addEventListener('click', () => {
                    if(this.debug){
                        console.log("update via switch to recovery button clicked");
                    }
                
                    if( document.getElementById('extension-power-settings-switch-to-recovery-understand').value != 'I understand'){
                        alert("You must type 'I understand' before the system update can start.");
                    }
                    else{
                        document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'none';
                        document.getElementById('extension-power-settings-update-recovery-container').style.display = 'none';
                    
                        window.API.postJson(
                            `/extensions/${this.id}/api/ajax`, {
                                'action': 'switch_to_recovery'
                            }
                        ).then((body) => {
                            if(this.debug){
                                console.log("switch_to_recovery response: ", body);
                            }
                            if(body.state = 'ok'){
                                document.getElementById('extension-power-settings-switch-to-recovery-busy-container').style.display = 'block';
                                
                                setTimeout(() => {
                                    
                                    console.log("40 seconds have passed. Time to check if the recovery partition is running");
                                    var message_counter = 0;
                                    
                                    fetch('/message.json')
                                    .then(response => {
                                         if (!response.ok) {
                                             throw new Error("HTTP error " + response.status);
                                         }
                                         return response.json();
                                    })
                                    .then(json => {
                                         console.log("managed to fetch a status message!", json);
                                         window.recovery_messages_interval = setInterval(function () {
                                             fetch('./message.json')
                                             .then((response) => response.json())
                                             .then((json) => {
                                                 console.log(json);
                                                 document.getElementById('message').innerHTML = json.message;
                    
                                                 if(json.message != previous_message){
                                                     previous_message = json.message;
                                                     console.log("New message: ", json.message);
                                                     message_counter++;
                                                     //document.getElementById('progress-bar').style.width = (counter * 10) + "%";
                                                 }
                    
                                             })
                                             .catch(function () {
                                                 console.error("failed to fetch message from recovery");
                                             });
                                             
                                         }, 4000);
                                     })
                                     .catch(function () {
                                         console.error("Failed to load message.json");
                                         setTimeout(function(){
                                              window.location.replace(window.location.origin);
                                         }, 30000);
                                     })
                                
                                }, 40000);
                                   
                                
                                
                                
                                window.API.postJson('/settings/system/actions', {
                                    action: 'restartSystem'
                                }).catch(console.error);
                            }
                            else{
                                alert("Please upgrade the Update & Recovery system first");
                            }
                        
                        }).catch((e) => {
                            console.error("Could not start upgrade - connection error");
                            document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'block';
                            alert("Could not start upgrade - connection error");
                        });
                    }
                    
                });
                
                
                
                
                
                
                // Files check button
                document.getElementById('extension-power-settings-update-files-check-button').addEventListener('click', () => {
                    //console.log("files check button clicked");
                    document.getElementById('extension-power-settings-update-files-check-button').style.display = 'none';
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'files_check'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("files_check response: ", body);
                        }
                        try{
                            if(body.files_check_output == ""){
                                document.getElementById('extension-power-settings-update-files-check-output').innerText = "OK, no missing files";
                            }
                            else{
                                document.getElementById('extension-power-settings-update-files-check-output').innerHTML = body.files_check_output;
                            }
                        }
                        catch(e){
                            console.log("Error in files_check api: ", e);
                        }
                        
                        
                    }).catch((e) => {
                        alert("Error, could not run files check, connection issue");
                    });
                    
                });
                
                
                
                
                
                //  Change hostname
                
    			document.getElementById("domain-settings-local-update").addEventListener('click', () => {
    				//console.log("change hostname button clicked");
                    
                    const domain_update_button = document.getElementById("domain-settings-local-update");
                    document.getElementById("domain-settings-local-update").style.display = 'none';
                    
                    const new_domain = document.getElementById('domain-settings-local-name').value;
                    const suffix = document.getElementById('domain-settings-local-suffix').innerText;
                    //console.log(new_domain,suffix);
                    
                    var after_html = "";
                    const explanation_el = document.getElementById('extension-power-settings-domain-explanation');
                    
                    if(explanation_el != null){
                        explanation_el.parentNode.removeChild(explanation_el);
                    }
                    
                    if(this.kiosk){
                        after_html = '<p id="extension-power-settings-domain-explanation">If all went well you can now use Candle from other devices on your local network by visiting:<br/><br/> <strong>http://' + new_domain + suffix + '</strong></p>';
                    }
                    else{
                        after_html = '<p id="extension-power-settings-domain-explanation">If all went well then in about 10 seconds you should switch to <a href="http://' + new_domain + suffix + '" style="color:white;font-weight:bold">' + new_domain + suffix + '</a> to continue using Candle.</p>';
                    }
                    
                    domain_update_button.insertAdjacentHTML('afterend', after_html);
                    
                    setTimeout(() => {
                        domain_update_button.style.display = 'block';
                    }, 8000);
                    
                    //document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<div class="extension-power-settings-spinner"><div></div><div></div><div></div><div></div></div>';
                    //this.upload_files(filesSelected);
    			});
                
                
            }
            else{
                console.error("power settings error: settings menu didn't exist yet, so cannot append additional elements");
            }
            
            
        } // end of create extra settings

        
		
		get_init(){
			
            const hours = document.getElementById('extension-power-settings-form-hours');
            const minutes = document.getElementById('extension-power-settings-form-minutes');
            const ntp = document.getElementById('extension-power-settings-form-ntp');
            
            window.API.postJson(
                `/extensions/${this.id}/api/init`, {
                    'init': 1
                }
            ).then((body) => {
                
                // If the Candle overlay was active, then it shouldn't be anymmore.
                document.getElementById('candle-tools').style.display = 'none';
				
                if(typeof body.debug != 'undefined'){
                    this.debug = body.debug;
					if(this.debug){
						console.log("power settings: debugging enabled. init response: ", body);
					}
                }
                else{
                    console.error("power settings: init response: body.debug was undefined. Body: ", body);
					if(this.second_init_attempted == false){
						console.log("trying power settings init again in 10 seconds");
						setTimeout(() => {
							this.second_init_attempted = true
							this.get_init();
						},10000);
						return
					}
					
                }
                
                
                
                if(this.debug){
                    console.log('power settings debug: init response: ', body);
                }
                
                // Does the recovery partition exist?
                if(typeof body.recovery_partition_exists != 'undefined'){
                    this.recovery_partition_exists = body.recovery_partition_exists;
                    if(this.debug){
                        console.log('power settings debug: this.recovery_partition_exists: ', this.recovery_partition_exists);
                    }
                    if(this.recovery_partition_exists == false){
                        if(this.debug){
                            console.log('power settings: there is no recovery partition');
                        }
                        document.getElementById('extension-power-settings-update-recovery-not-supported').style.display = 'block';
                        document.getElementById('extension-power-settings-update-recovery-container').style.display = 'none';
                        document.getElementById('extension-power-settings-switch-to-recovery-container').style.display = 'none';
                    }
                    else{
                        if(this.debug){
                            console.log('power settings: recovery partition exists');
                        }
                        document.getElementById('extension-power-settings-system-update-available-container').style.display = 'none';
                    }
                }
                
                // show server time in input fields
                if(typeof body.hours != 'undefined'){
                    hours.placeholder = body['hours'];
                    minutes.placeholder = body['minutes'];
                }
                if(typeof body.ntp != 'undefined'){
                    ntp.checked = body['ntp'];
                    if(body['ntp'] == false){
                        document.getElementById('extension-power-settings-manually-set-time-container').style.display = 'block';
                    }
                }
                
                
                if(typeof body.allow_anonymous_mqtt != 'undefined'){
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
                        if(this.debug){
                            console.log('allow anonymous MQTT checkbox value changed');
                        }
                
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
                }
                
                
                // 32 or 64 bits
                if(typeof body.bits != 'undefined'){
                    this.bits = parseInt(body.bits);
                    if(this.debug){
                        console.log("power settings: system bits: ", this.bits);
                    }
                    document.getElementById('extension-power-settings-bits').innerText = this.bits + 'bit';
                    //document.getElementById('extension-power-settings-bits2').innerText = this.bits + 'bit';
                }
				
                // Device model
                if(typeof body.device_model != 'undefined'){
                    if(this.debug){
                        console.log("power settings: device_model: ", body.device_model);
                    }
                    document.getElementById('extension-power-settings-device-model').innerText = body.device_model;
                }
				
                if(typeof body.device_linux != 'undefined'){
                    if(this.debug){
                        console.log("power settings: device_linux: ", body.device_linux);
                    }
                    document.getElementById('extension-power-settings-device-linux').innerText = body.device_linux;
					if(body.device_kernel != ''){
						document.getElementById('extension-power-settings-device-kernel').innerText = body.device_kernel;
					}
                }
				
                if(typeof body.device_kernel != 'undefined'){
                    if(this.debug){
                        console.log("power settings: device_kernel: ", body.device_kernel);
                    }
					if(body.device_kernel != ''){
						document.getElementById('extension-power-settings-device-kernel').innerText = body.device_kernel;
					}
                }
				
                if(typeof body.device_sd_card_size != 'undefined'){
                    if(this.debug){
                        console.log("power settings: sd_card_size: ", body.device_sd_card_size);
                    }
                    document.getElementById('extension-power-settings-device-sd-card-size').innerText = Math.round(body.device_sd_card_size / 1000000000) + "GB";
                }
				
                
                if(typeof body.exhibit_mode != 'undefined'){
                    this.exhibit_mode = body.exhibit_mode;
                    if(this.debug){
                        console.log("power settings: exhibit mode: ", this.exhibit_mode);
                    }
                    if(this.exhibit_mode){
                        document.body.classList.add('exhibit-mode');
                    }
                }
                
                
                // Hardware clock detected
                if(typeof body.hardware_clock_detected != 'undefined'){
                    if(body.hardware_clock_detected){
                        document.body.classList.add('hardware-clock');
                        document.getElementById('extension-power-settings-manually-set-time-container').style.display = 'block';
                    }
                }
                
				
                // User partition expanded
                if(typeof body.user_partition_expanded != 'undefined'){
                    if(body.user_partition_expanded == false){
                        if(this.debug){
							console.log("power settings: user partition not yet expanded");
						}
                        if(document.getElementById('extension-power-settings-user-partition-expansion-hint') != null){
							document.getElementById('extension-power-settings-user-partition-expansion-hint').style.display = 'block';
                        }
                    }
					else{
						console.log("power settings: user partition seems to be fully expanded");
					}
                }
                
                
				// Printing
				if(typeof body.printing_allowed != 'undefined'){
					this.printing_allowed = body.printing_allowed;
					if(document.getElementById('extension-power-settings-allow-printing-checkbox') != null){
						document.getElementById('extension-power-settings-allow-printing-checkbox').checked = this.printing_allowed;
					}
					
					if (this.printing_allowed){
						document.body.classList.add('cups-printing');
					}
					else{
						document.body.classList.remove('cups-printing');
					}
				}
				
				if(typeof body.has_cups != 'undefined'){
					if(body.has_cups == true){
						if(this.debug){
							console.log("Printing via CUPS is supported");
						}
						document.body.classList.add('cups-printing');
						document.getElementById('extension-power-settings-main-menu-printer-item').style.display = 'block';
					}
					else{
						document.body.classList.remove('cups-printing');
						document.getElementById('extension-power-settings-main-menu-printer-item').style.display = 'none';
						if(this.debug){
							console.log("printing via CUPS is not supported");
						}
					}
				}
				
				
                // Show Candle version
                if(typeof body.candle_version != 'undefined'){
                    document.getElementById('extension-power-settings-candle-version').innerText = body.candle_version;
                    //document.getElementById('extension-power-settings-candle-version2').innerText = body.candle_version;
                }
                
                if(typeof body.bootup_actions_failed != 'undefined'){
                    if(body.bootup_actions_failed == true){
                        document.getElementById('extension-power-settings-update-failed').style.display = 'block';
                    }
                }
                
                // Show a pop-up modal message after a system update
                if(typeof body.just_updated_via_recovery != 'undefined' && typeof body.updated_via_recovery_aborted != 'undefined' && typeof body.updated_via_recovery_interupted != 'undefined'){
                    if(body.just_updated_via_recovery || body.update_via_recovery_aborted || body.update_via_recovery_interupted){
                        var div = document.createElement('div');
                        div.setAttribute('id','extension-power-settings-just_updated-via-recovery-container');
                        var modal_html = '<div id="extension-power-settings-just_updated-via-recovery">'
                        if(body.just_updated_via_recovery){
                            modal_html += '<h1>Your controller has been updated</h1>';
                            div.style.background="green";
                            
                            // Extra warning after switch to 64 bit
                            if(body.candle_original_version == '2.0.1' || body.candle_original_version == '2.0.0' || body.candle_original_version == '2.0.0-beta'){
                                modal_html += '<p>If any addons are not working properly, try re-installing them.</p>';
                            }
                        }
                        else if(body.update_via_recovery_aborted){
                            modal_html += '<h1>The controller update process failed</h1><p>Please try again</p>';
                            div.style.background="red";
                        }
                        else if(body.update_via_recovery_interupted){
                            modal_html += '<h1>The controller update process was interupted</h1><p>Frankly it is amazing you are even seeing this message. You should probably run the update process again.</p>';
                            div.style.background="red";
                        }
                        modal_html += '<div style="text-align:right"><button id="extension-power-settings-just_updated-via-recovery-ok-button" class="text-button">OK</button></div></div>';
                        div.innerHTML = modal_html;
                        document.body.appendChild(div);
                        document.getElementById('extension-power-settings-just_updated-via-recovery-ok-button').addEventListener('click', () => {
                            document.getElementById('extension-power-settings-just_updated-via-recovery-container').style.display = 'none';
                        });
                    }
                }
                
                
            }).catch((e) => {
                console.error("power-settings init error: ", e);
            });
		}
        
        
        
        
        show_clock_page(){
            //console.log("in show_clock_page");
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'clock_page_init'
                }
            ).then((body) => {
                if(this.debug){
                    console.log("clock page init response: ", body);
                }
                if(typeof body.shell_date != 'undefined'){
                    document.getElementById('extension-power-settings-shell-date').innerText = body.shell_date;
                }
                else{
                    document.getElementById('extension-power-settings-shell-date').innerText = "";
                }
                
            }).catch((e) => {
               console.error("Error: clock page init: connection failed: ", e);
            });
        }
        
        
        
        show_update_available(){
            // Show that an update is available
            if(this.debug){
                console.log("power settings debug: in show_update_available. this.overlay_exists: ", this.overlay_exists);
            }
            
            if(this.update_available_text != ""){
                if(document.getElementById('extension-power-settings-menu-update-button-indicator') != null){
                    document.getElementById('extension-power-settings-menu-update-button-indicator').innerText = this.update_available_text;
                }
                
                document.getElementById('extension-power-settings-no-updates').style.display = 'none';
                if(!this.recovery_partition_exists){
                    document.getElementById('extension-power-settings-system-update-available-container').style.display = 'block';
                }
                
                
                document.getElementById('extension-power-settings-menu-update-button').style.border = "2px solid white";
                document.getElementById('extension-power-settings-menu-update-button').style.borderRadius = ".5rem";
                
                if(this.overlay_exists){
                    document.getElementById('extension-power-settings-system-update-overlay-still-enabled-container').style.display = 'block';
                    document.getElementById('extension-power-settings-system-update-overlay-disabled-container').style.display = 'none';
                }
                else{
                    document.getElementById('extension-power-settings-system-update-overlay-still-enabled-container').style.display = 'none';
                    document.getElementById('extension-power-settings-system-update-overlay-disabled-container').style.display = 'block';
                }
                
            }
            else{
                document.getElementById('extension-power-settings-no-updates').style.display = 'block';
                document.getElementById('extension-power-settings-update-progress-container').style.display = 'none';
                
            }
        }
        
        
        
        start_update(){
            
            document.getElementById('message-area').style.opacity = "0"; // avoid showing error messages that might confuse
            
            const cutting_edge_state = document.getElementById('extension-power-settings-cutting-edge-checkbox').checked;
            if(this.debug){
                console.log("cutting_edge_state: ", cutting_edge_state);
            }
            const live_update_state = document.getElementById('extension-power-settings-live-update-checkbox').checked;
            if(this.debug){
                console.log("live_update_state: ", live_update_state);
            }
            
            
            /*
            if(live_update_state == true){
                var progress_bar = document.getElementById('extension-power-settings-update-process-progress-bar-container');
                progress_bar.style.display = "block";
                document.body.appendChild(progress_bar);
            }
            */
            
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'start_system_update', 'cutting_edge':cutting_edge_state, 'live_update':live_update_state
                }
            ).then((body) => {
                if(this.debug){
                    console.log("start system update response: ", body);
                }
                
                if (body.state == false){
                    document.getElementById('extension-power-settings-update-progress-container').style.display = 'none';
                    alert("Starting the update seems to have failed");
                }
                else{
                    this.overlay_exists = false;
                    document.getElementById('extension-power-settings-system-update-available-container').style.display = 'none';
                    document.getElementById('extension-power-settings-update-progress-container').style.display = 'block';
                }
        
            }).catch((e) => {
                console.log("Error, could not start system update: could not connect to controller: ", e);
            });
            
            
            this.start_poll();
			
        }
        
        
        
        
        start_recovery_poll(){
            if(this.debug){
                console.log("in start_recovery_poll");
            }
            
			try{
				clearInterval(this.recovery_interval);
                this.recovery_interval = null;
                if(this.debug){
                    console.log("cleared old recovery_interval for /poll");
                }
			}
			catch(e){
				//console.log("no interval to clear?: " + e);
			}
            
            if(this.recovery_interval == null){
    			this.recovery_interval = setInterval(() => {
                    if(this.debug){
                        console.log("in recovery_interval for /poll");
                    }
                    
                    try{
                        // /poll
        		        window.API.postJson(
        		          `/extensions/${this.id}/api/ajax`,
                            {'action':'recovery_poll'}

        		        ).then((body) => {
                            
                            try{
                                if(this.debug){
                                    console.log("recovery update poll response: ", body);
                                }
                                
                                if(typeof body.busy_updating_recovery != 'undefined'){
                                    if(this.debug){
                                        console.log("body.busy_updating_recovery: ", body.busy_updating_recovery);
                                    }
                                    
                                    const recovery_hints = ['','downloading...','extracting...','deleting old recovery system...','installing...','done'];
                                    document.getElementById('extension-power-settings-update-recovery-progress-hint').innerText = recovery_hints[body.busy_updating_recovery];
                                    
                                    if(body.busy_updating_recovery > 0 && body.busy_updating_recovery < 5){
                                        document.getElementById('extension-power-settings-update-recovery-busy').style.display = 'block';
                                        document.getElementById('extension-power-settings-update-recovery-busy-progress').style.width = (body.busy_updating_recovery * 20) + '%';
                                    }
                                    if(body.busy_updating_recovery > 0){
                                        
                                        if(body.updating_recovery_failed == true){
                                            document.getElementById('extension-power-settings-update-recovery-busy').style.display = 'none';
                                            document.getElementById('extension-power-settings-update-recovery-failed').style.display = 'block';
                                            document.getElementById('extension-power-settings-update-recovery-step-hint').innerText = "";
                                        }
                                    }
                                    
                                    
                                    
                                    
                                    if(body.updating_recovery_failed){
                                        
                                    }
                                    if(body.busy_updating_recovery == 0){
                                        
                                    }
                                    else if(body.busy_updating_recovery == 1){
                                        
                                    }
                                    
                                    
                                    if(body.busy_updating_recovery == 5){
                                        
                                        document.getElementById('extension-power-settings-update-recovery-should-update').style.display = 'none';
                                        document.getElementById('extension-power-settings-update-recovery-busy').style.display = 'none';
                                        //document.getElementById('extension-power-settings-update-recovery-ok').style.display = 'block';
                                        
                                        
                                        if(body.allow_update_via_recovery){
                                            if(this.debug){
                                                console.log("recovery partition update seems to have gone well");
                                            }
                                            document.getElementById('extension-power-settings-update-recovery-ok').style.display = 'block';
                                            this.update_checks();
                                        }
                                        else{
                                            if(this.debug){
                                                console.warn("recovery partition was updated, but allow_update_via_recovery was still false");
                                            }
                                        }
                                        
                                        clearInterval(this.recovery_interval);
                                    }
                                }
                                
                            }
                            catch(e){
                                console.log("Error in try/catch inside /poll request: ", e);
                            }
                        
    
        		        }).catch((e) => {
        		  			console.log("Error calling /poll: ", e);
        		        });
    
                    }
                    catch(e){
                        console.log("Error doing poll: ", e);
                    }
                
                    /*
                    if(this.volume_indicator_countdown > 0){
                        this.volume_indicator_countdown--;
                        if(document.getElementById('extension-internet-radio-volume-indicator-container') != null){
                            if(this.volume_indicator_countdown == 0){
                                document.getElementById('extension-internet-radio-volume-indicator-container').classList.add('extension-internet-radio-hidden');
                            }
                        }
                    }
                    */

    			}, 5000);
            }
            
            
        }
        
        
        start_poll(){
            if(this.debug){
                console.log("in start_poll");
            }
            // reset process output, just in case
            
            
            if( this.overlay_exists == false ){
                if(this.debug){
                    console.log("start_poll: overlay does not exist");
                }
                document.getElementById('extension-power-settings-update-process-output').innerHTML = "";
                //document.getElementById('extension-power-settings-system-update').style.display = 'none';
                document.getElementById('extension-power-settings-manual-update-container').style.display = 'none';
                document.getElementById('extension-power-settings-system-update-available-container').style.display = 'none';
                
                if( document.querySelector("body > #extension-power-settings-update-process-progress-bar-container") == null ){
                    if(this.debug){
                        console.log("moving progress bar into position");
                    }
                    var progress_bar = document.getElementById('extension-power-settings-update-process-progress-bar-container');
                    progress_bar.style.display = "block";
                    document.body.appendChild(progress_bar);
                }
                
                // Indicate update in progress on power buttons page
                if(document.getElementById('extension-power-settings-main-buttons') != null){
                    document.getElementById('extension-power-settings-main-buttons').style.display = 'none';
                    document.getElementById('extension-power-settings-update-in-progress-warning').style.display = 'block';
                }
                
            }
            else{
                if(this.debug){
                    console.log("start_poll: overlay still exist");
                }
            }

            
			try{
				clearInterval(this.interval);
                this.interval = null;
                if(this.debug){
                    console.log("cleared old interval for /poll");
                }
			}
			catch(e){
				//console.log("no interval to clear?: " + e);
			}
            
            if(this.interval == null){
    			this.interval = setInterval(() => {
                    if(this.debug){
                        console.log("in interval for /poll");
                    }
                    /*
                    if(document.getElementById('connectivity-scrim').classList.contains('hidden')){
                        // UI still connected to controller
                    }else{
                        document.getElementById('extension-power-settings-update-process-progress-bar-container').style.display = "none";
                    }
                    */
                    
                    try{
                        // /poll
        		        window.API.postJson(
        		          `/extensions/${this.id}/api/ajax`,
                            {'action':'poll'}

        		        ).then((body) => {
                            
                            try{
                                if(this.debug){
                                    console.log("system update poll response: ", body);
                                }
                    
                                if(typeof body.dmesg != 'undefined' && document.getElementById('extension-power-settings-update-process-output') != null){
                                    document.getElementById('extension-power-settings-update-process-output').innerHTML = body.dmesg;
                                	
									/*
                                    if(body.dmesg == ""){
                                        document.getElementById('extension-power-settings-update-progress-container').style.display = "none";
                                    }
                                    else{
                                        document.getElementById('extension-power-settings-update-progress-container').style.display = "block";
                                    }
									*/
                                    if(body.dmesg != ""){
                                        const dmesg_lines = body.dmesg.split("\n");
                                        if(this.debug){
                                            console.log("dmesg_lines: ", dmesg_lines);
                                            console.log("dmesg_lines.length: ", dmesg_lines.length);
                                        }
                                        document.getElementById('extension-power-settings-update-process-progress-bar').style.width = dmesg_lines.length + "%";
                                    }
                                    
                                    
                                }
                                
                                if(typeof body.system_update_in_progress != 'undefined'){
                                    if(this.debug){
                                        console.log("body.update_in_progress: ", body.system_update_in_progress);
                                    }
                                    
                                    this.system_update_in_progress = body.system_update_in_progress;
                                    
                                    // UPDATE IN PROGRESS
                                    if( body.system_update_in_progress == true){
                                        document.getElementById('message-area').style.opacity = "0"
                                        if(this.debug){
                                            console.log("poll: system update in progress");
                                        }
                                        if(document.getElementById('extension-power-settings-main-buttons') != null){
                                            document.getElementById('extension-power-settings-main-buttons').style.display = 'none';
                                            document.getElementById('extension-power-settings-update-in-progress-warning').style.display = 'block';
                                        }
                                        
                                        document.getElementById('extension-power-settings-update-progress-container').style.display = 'block';
                                        document.getElementById('extension-power-settings-update-process-progress-bar-container').style.display = 'block';
                                        
                                        document.getElementById('extension-power-settings-menu-update-button').style.border = "2px solid white";
                                        document.getElementById('extension-power-settings-menu-update-button').style.borderRadius = ".5rem";
                                        if(document.getElementById('extension-power-settings-menu-update-button-indicator') != null){
                                            document.getElementById('extension-power-settings-menu-update-button-indicator').innerText = "in progress";
                                        }
                                        document.body.classList.add("system-updating");
                                        document.body.classList.remove("system-update-available");
                                        
                                        if(typeof body.dmesg != 'undefined'){
                                            if( body.dmesg.indexOf('ERROR') != -1 ){
                                                document.getElementById('extension-power-settings-system-update-error').style.display = 'block';
                                            }
                                        }
                                        
                                        if( document.querySelector("body > #extension-power-settings-update-process-progress-bar-container") == null ){
                                            if(this.debug){
                                                console.log("moving progress bar into position");
                                            }
                                            var progress_bar = document.getElementById('extension-power-settings-update-process-progress-bar-container');
                                            progress_bar.style.display = "block";
                                            document.body.appendChild(progress_bar);
                                        }
                                        
                                        
                                    }
                                    
                                    // UPDATE NOT IN PROGRESS
                                    else{
                                        document.getElementById('message-area').style.opacity = "1"
                                        if(this.debug){
                                            console.log("poll: system update NOT in progress");
                                        }
                                        document.body.classList.remove("system-updating");
                                        
                                        document.getElementById('extension-power-settings-update-progress-container').style.display = 'none';
                                        document.getElementById('extension-power-settings-update-process-progress-bar-container').style.display = 'none';
                                        
                                        document.getElementById('extension-power-settings-menu-update-button').style.border = "none";
                                        if(document.getElementById('extension-power-settings-menu-update-button-indicator') != null){
                                            document.getElementById('extension-power-settings-menu-update-button-indicator').innerText = "";
                                        }
                                        //document.getElementById('extension-power-settings-update-process-output').innerHTML = "";
                                        //document.getElementById('extension-power-settings-system-update').style.display = 'none';
                                        //document.getElementById('extension-power-settings-manual-update-container').style.display = 'block';
                                        //document.getElementById('extension-power-settings-system-update-available-container').style.display = 'none';

                                        // Remove update in progress indicator on power buttons page
                                        if(document.getElementById('extension-power-settings-main-buttons') != null){
                                            document.getElementById('extension-power-settings-main-buttons').style.display = 'block';
                                            document.getElementById('extension-power-settings-update-in-progress-warning').style.display = 'none';
                                        }
                                        
                                        /*
                            			try{
                            				clearInterval(this.interval);
                                            this.interval = null;
                            			}
                            			catch(e){
                            				//console.log("no interval to clear?: " + e);
                            			}
                                        */
                                    }
                                }
                                
                                if(typeof body.old_overlay_active != 'undefined' && typeof body.ro_exists != 'undefined'){
                                    if(body.ro_exists == false && body.old_overlay_active == false){
                                        if(this.debug){
                                            console.log("no overlays detected, update is good to go");
                                        }
                                        document.getElementById('extension-power-settings-system-update-overlay-still-enabled-container').style.display = 'none';
                                        document.getElementById('extension-power-settings-system-update-overlay-disabled-container').style.display = 'block';
                                    }
                                    else{
                                        if(this.debug){
                                            console.log("overlays detected, must first be disabled");
                                        }
                                        document.getElementById('extension-power-settings-system-update-overlay-still-enabled-container').style.display = 'block';
                                        document.getElementById('extension-power-settings-system-update-overlay-disabled-container').style.display = 'none';
                                    }
                                }
                                
                                
                                
                            }
                            catch(e){
                                console.log("Error in try/catch inside /poll request: ", e);
                            }
                        
    
        		        }).catch((e) => {
        		  			console.error("Error calling /poll: ", e);
        		        });
    
                    }
                    catch(e){
                        console.error("Error doing poll: ", e);
                    }
                
                    /*
                    if(this.volume_indicator_countdown > 0){
                        this.volume_indicator_countdown--;
                        if(document.getElementById('extension-internet-radio-volume-indicator-container') != null){
                            if(this.volume_indicator_countdown == 0){
                                document.getElementById('extension-internet-radio-volume-indicator-container').classList.add('extension-internet-radio-hidden');
                            }
                        }
                    }
                    */

    			}, 10000);
            }
            
        }



        show() {
            if (this.content == '') {
                return;
            }
            this.view.innerHTML = this.content;
            
            const content = document.getElementById('extension-power-settings-content');

            const shutdown = document.getElementById('extension-power-settings-shutdown');
            const reboot = document.getElementById('extension-power-settings-reboot');
            const restart = document.getElementById('extension-power-settings-restart');

            const content_container = document.getElementById('extension-power-settings-content-container');
            
            const waiting = document.getElementById('extension-power-settings-waiting');
            const waiting_message = document.getElementById('extension-power-settings-waiting-message');

            //pre.innerText = "";

            
            
            
            // Hide fullscreen button on iOS devices
            var isIOS = (function () {
                var iosQuirkPresent = function () {
                    var audio = new Audio();

                    audio.volume = 0.5;
                    return audio.volume === 1;   // volume cannot be changed from "1" on iOS 12 and below
                };

                var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                var isAppleDevice = navigator.userAgent.includes('Macintosh');
                var isTouchScreen = navigator.maxTouchPoints >= 1;   // true for iOS 13 (and hopefully beyond)

                return isIOS || (isAppleDevice && (isTouchScreen || iosQuirkPresent()));
            })();
            
            if(isIOS){
                document.getElementById('extension-power-settings-fullscreen-button-container').style.display = 'none';
            }
            
            
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


            document.getElementById('extension-power-settings-logout').addEventListener('click', () => {
                /*
                content_container.style.display = 'none';
                waiting.style.display = 'block';
                waiting_message.innerHTML = '<h2>Shutting down...</h2><p>Please wait at least 15 seconds before unplugging the controller.</p>';
                */
                window.API.logout()
                .then((body) => {
                    console.log("log out done");
                    window.location.reload(true);
                }).catch((e) => {
          			console.log("Error saving token: ", e);
                });
                
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
            
            
			const expansion_more_button_el = document.getElementById('extension-power-settings-expand-user-partition-more-button');
            // Show System details page when clicking on expand partition more button
            if(expansion_more_button_el){
				expansion_more_button_el.addEventListener('click', () => {
                	this.hide_all_settings_containers();
                	document.getElementById('extension-power-settings-container-system').classList.remove('extension-power-settings-hidden');
                	document.getElementById('extension-power-settings-pages').classList.remove('hidden');
					this.get_stats();
				});
			}
            
			
			
            // Start expand user partition button
			/*
            document.getElementById("extension-power-settings-expand-user-partition-start-button").addEventListener('click', () => {
                this.start_partition_expansion();
            });
            */
            
            this.get_stats();
            
            
            // Hide the shutdown and reboot buttons if a system update is in progress
            if(this.system_update_in_progress == true){
                if(document.getElementById('extension-power-settings-main-buttons') != null){
                    document.getElementById('extension-power-settings-main-buttons').style.display = 'none';
                    document.getElementById('extension-power-settings-update-in-progress-warning').style.display = 'block';
                }
            }
            
            
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
            console.log("power settigns: in check if back");
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
        
        
        // calls update_init
        update_checks(){
            if(this.debug){
                console.log("power settings debug: in update_checks");
            }
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'update_init'
                }
            ).then((body) => {
                if(this.debug){
                    console.log("system update_init response: ", body);
                }
                
                if(typeof body.total_memory != 'undefined'){
                    if(body.total_memory < 1600){
                        document.getElementById('extension-power-settings-low-memory-hint').style.display = 'block';
                    }
                    this.total_memory = body.total_memory;
                    if(this.debug){
                        console.log("power settings: total memory: " + this.total_memory + "Mb");
                    }
                    document.getElementById('extension-power-settings-update-total-memory').innerText = this.total_memory;
                    
                }
                if(typeof body.user_partition_free_disk_space != 'undefined'){
                    this.user_partition_free_disk_space = body.user_partition_free_disk_space;
                    const free_user_disk = Math.floor(body.user_partition_free_disk_space / 1000);
                    if(this.debug){
                        console.log("power settings: user disk free: " + free_user_disk + "Mb, (" + this.user_partition_free_disk_space + ")");
                    }
                    document.getElementById('extension-power-settings-user-partition-free-disk-space').innerText = free_user_disk;
                }
                

                if(this.total_memory < 1600 && this.user_partition_free_disk_space < 1600000){
                    document.getElementById('extension-power-settings-update-no-space-available').style.display = 'block';
                }
                else{
                     document.getElementById('extension-power-settings-update-no-space-available').style.display = 'none';
                }
                
                
                // Show Candle original version
                if(typeof body.candle_original_version != 'undefined'){
                    if(this.debug){
                        console.log("power settings debug: body.candle_original_version: ", body.candle_original_version);
                    }
                    if(document.getElementById('extension-power-settings-candle-original-version') != null){
                        document.getElementById('extension-power-settings-candle-original-version').innerText = body.candle_original_version;
                        //document.getElementById('extension-power-settings-candle-original-version2').innerText = body.candle_original_version;
                    }
                    
                    if(body.candle_original_version == 'unknown'){
                        if(this.debug){
                            console.log("power settings: running on early release candidate");
                        }
                        this.update_available_text = "available";
                    }
                    else if(body.candle_original_version == '2.0.0'){
                        this.update_available_text = "available";
                        if(this.debug){
                            console.log("power settings: running on RC4");
                        }
                    }
                    else if(body.candle_original_version == '2.0.0-beta'){
                        this.update_available_text = "available"
                        if(this.debug){
                            console.log("power settings: running on updated release candidate, nice");
                        }
                    }
                    else if(body.candle_original_version == '2.0.1'){
                        this.update_available_text = "available"
                        if(this.debug){
                            console.log("power settings: running on 2.0.1");
                        }
                    }
                    else if(body.candle_original_version == '2.0.2'){
                        this.update_available_text = ""
                        if(this.debug){
                            console.log("power settings: running on 2.0.2, brilliant");
                        }
                    }
                    
                    if(body.candle_version == '2.0.2'){ // on the latest version
                        this.update_available_text = ""
                        if(this.debug){
                            console.log("power settings debug: running on latest available 2.0.2 version");
                        }
                    }
                    
                    if(this.update_available_text != ""){
                        if(this.debug){
                            console.log("A SYSTEM UPDATE IS AVAILABLE");
                        }
                        document.body.classList.add('system-update-available');
                    }
                    
                    if(body.ro_exists == true){
                        if(this.debug){
                            console.log("/ro exists");
                        }
                    }
                    

                    if(this.system_update_in_progress == false){
                        setTimeout( () => {
                            this.show_update_available(); // reacts to this.update_avaiable_text value
                        }, 3000);
                    }
                    else{
                        document.getElementById('extension-power-settings-update-progress-container').style.display = 'block';
                        document.getElementById('extension-power-settings-no-updates').style.display = 'none';
                        document.getElementById('extension-power-settings-menu-update-button').style.border = "2px solid white";
                        document.getElementById('extension-power-settings-menu-update-button').style.borderRadius = ".5rem";
                    }
        
                    if(body.files_check_exists){
                        document.getElementById('extension-power-settings-update-files-check-button').style.display = 'inline-block';
                    }
                    
                    if(body.update_needs_two_reboots == true){
                        //document.getElementById('extension-power-settings-system-update-needs-two-reboots').style.display = 'block';
                    }
        
                }
                else{
                    if(this.debug){
                        console.log("power settings error, candle_original_version was not defined. body: ", body);
                    }
                }
        
                
                if(this.recovery_partition_exists){
                    if(this.debug){
                        console.log("power settings: recovery partition exists. Adding class.");
                    }
                    // Show only the recovery partition update system. Developers can still see and use the old system.
                    document.getElementById('extension-power-settings-container-update').classList.add('has-recovery-partition');
                    
                    // Allow developers to reveal the recovery update options, even if the system is already up to date
                    document.getElementById('extension-power-settings-force-reveal-recovery-update-button').style.display = 'block';
                }
                
                
                if(typeof body.system_update_in_progress != 'undefined'){
                    this.system_update_in_progress = body.system_update_in_progress;
                    if(body.system_update_in_progress == true){
                        if(this.debug){
                            console.log("A SYSTEM UPDATE IS ALREADY IN PROGRESS (bootup_actions.sh on an older release candidate)");
                        }
                        this.update_available_text = "in progress...";
						document.getElementById('extension-power-settings-update-progress-container').style.display = 'block';
						if(document.getElementById('extension-power-settings-menu-update-button-indicator') != null){
                            document.getElementById('extension-power-settings-menu-update-button-indicator').innerText = "in progress";
                        }
                        this.start_poll();
                    }
                    else{
                        document.getElementById('extension-power-settings-update-progress-container').style.display = 'none';
                       if(document.getElementById('extension-power-settings-menu-update-button-indicator') != null){
                            document.getElementById('extension-power-settings-menu-update-button-indicator').innerText = "";
                        }
                    }
                }
                
                
                if(typeof body.old_overlay_active != 'undefined' && typeof body.ro_exists != 'undefined' && typeof body.post_bootup_actions_supported != 'undefined'){
                    
                    if(body.ro_exists == false && body.old_overlay_active == false){
                        this.overlay_exists = false;
                        if(this.debug){
                            console.log("power settings debug: no overlays detected, update is good to go");
                        }
                        document.getElementById('extension-power-settings-system-update-overlay-still-enabled-container').style.display = 'none';
                        document.getElementById('extension-power-settings-system-update-overlay-disabled-container').style.display = 'block';
                    }
                    else{
                        this.overlay_exists = true;
                        if(this.debug){
                            console.log("overlays detected, must first be disabled");
                        }
                        document.getElementById('extension-power-settings-system-update-overlay-still-enabled-container').style.display = 'block';
                        document.getElementById('extension-power-settings-system-update-overlay-disabled-container').style.display = 'none';
                    }
                    
                }
                
                
                // Show Update & Recovery partition version
                if(this.recovery_partition_exists){
                    if(typeof body.recovery_version != 'undefined'){
                        document.getElementById('extension-power-settings-update-recovery-version').innerText = body.recovery_version;
                    
                        // Is a new version of the recovery partition available?
                        if(body.recovery_version == body.latest_recovery_version){
                            document.getElementById('extension-power-settings-update-recovery-ok').style.display = 'block';
                            if(document.body.classList.contains('developer')){
                                document.getElementById('extension-power-settings-update-recovery-should-update').style.background = '#555';
                                document.getElementById('extension-power-settings-update-recovery-should-update').style.display = 'block';
                                document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'block';
                            }
                        }
                        else{
                            if(this.debug){
                                console.log("power settings: a new version of the Update & Recovery partition is available: V", body.latest_recovery_version);
                            }
                            
                            
                            document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'none';
                            document.getElementById('extension-power-settings-update-recovery-container').style.display = 'block';
                            document.getElementById('extension-power-settings-update-recovery-should-update').style.display = 'block';
                    
                        }
                    }
                    
                    if(typeof body.updating_recovery_failed != 'undefined'){
                    
                        if(body.updating_recovery_failed){
                            if(this.debug){
                                console.warn("body.updating_recovery_failed!");
                            }
                            document.getElementById('extension-power-settings-update-recovery-failed').style.display = 'block';
                            document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'none';
                        }
                    }
                    
                    if(typeof body.allow_update_via_recovery != 'undefined'){
                        if(body.allow_update_via_recovery == false){
                            if(this.debug){
                                console.log("Switch to recovery partition currently not supported (maybe recovery partition needs update first, or doesn't exist. Or no ethernet cable.)");
                            }
                            document.getElementById('extension-power-settings-switch-to-recovery-container').style.display = 'none';
                        }
                    }
                    else{
                        console.error("power settings: allow_update_via_recovery is not present in init data");
                    }
                
                    if(typeof body.busy_updating_recovery != 'undefined'){
                        if(body.busy_updating_recovery > 0 && body.busy_updating_recovery < 5){
                            if(this.debug){
                                console.warn("recovery partition update already in progress");
                            }
                            document.getElementById('extension-power-settings-update-recovery-button').style.display = 'none';
                            document.getElementById('extension-power-settings-update-recovery-busy').style.display = 'block';
                            document.getElementById('extension-power-settings-update-recovery-busy-progress').style.width = (body.busy_updating_recovery * 20) + '%';
                            if(this.recovery_interval == null){
                                this.start_recovery_poll();
                            }
                            
                        }f
                    }
                    
                }
                else{
                    if(typeof body.recovery_version != 'undefined'){
                        document.getElementById('extension-power-settings-update-recovery-version').innerText = "unsupported";
                    }
                }
                
                
                // Show the ethernet cable warning?
                if(typeof body.ethernet_connected != 'undefined'){
                    this.ethernet_connected = body.ethernet_connected;
                    if(this.ethernet_connected){
                        document.getElementById('extension-power-settings-pages-update-missing-ethernet').classList.add('hidden');
                        document.getElementById('extension-power-settings-switch-to-recovery-start-container').classList.remove('hidden');
                    }
                    else{
                        document.getElementById('extension-power-settings-pages-update-missing-ethernet').classList.remove('hidden');
                        document.getElementById('extension-power-settings-switch-to-recovery-start-container').classList.add('hidden');
                    }
                }
                
                if(this.debug){
                    console.log("update_checks: this.update_available_text: ", this.update_available_text);
                }
                
                // Show the switch-to-recovery update option?
                
                if(typeof body.allow_update_via_recovery != 'undefined'){
                    if(body.allow_update_via_recovery){
                        //if(body.busy_updating_recovery == 5){
                        //    document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'block';
                        //}
                        
                        
                        if(this.update_available_text == "available"){
                            
                            document.getElementById('extension-power-settings-switch-to-recovery-container').style.display = 'block';
                            
                            if(this.ethernet_connected){
                                document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'block';
                            }
                            else{
                                document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'none';
                                if(this.debug){
                                    console.log("- ethernet not connected");
                                }
                            }
                        }
                        else{
                            document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'none';
                            if(this.debug){
                                console.log("- this.update_available_text was not 'available'");
                            }
                            
                            //if(this.update_available_text == "in progress"){
                                
                            //}
                        }
                        
                    }
                    else{
                        document.getElementById('extension-power-settings-switch-to-recovery-start-container').style.display = 'none';
                        if(this.debug){
                            console.log("- not allowing update via recovery, hiding switch-to-recovery-button");
                        }
                    }
                }
                
                
                // dealing with recovery_partition_bits is no longer needed, as having the recovery partition be 32 bits works for both 32 and 64 bit kernels
                
            }).catch((e) => {
                console.log("Error: update_checks could not connect to controller: ", e);
            });
        }
        
        
        
        hide_all_settings_containers(){
            document.getElementById('extension-power-settings-pages').classList.add('hidden');
            document.querySelectorAll('.extension-power-settings-container').forEach( el => {
                el.classList.add('extension-power-settings-hidden');
            });
			
            try {
                window.clearInterval(this.get_stats_interval);
				this.get_stats_interval = null;
            } catch (e) {
				
            }
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

                //document.getElementById('extension-power-settings-upload-progress-container').style.display = 'block';
                    
                //console.log("this1: ", this);
    		    var reader = new FileReader();

                /*
                function handleEvent(event) {
                    console.log("file upload event: ", event);
                    //console.log(`${event.type}: ${event.loaded} bytes transferred`);

                    if (event.type === "progress") {
                        console.log("progress event");
                        if(event.lengthComputable){
                            console.log("upload length is computable");
                            const percent = (event.loaded / event.total ) * 100;
                            console.log("upload percent: ", percent);
                            //document.getElementById('extension-power-settings-upload-progress-bar').style.width = percent + "%";
                        }
                    }
                }

                function addListeners(reader) {
                    //reader.addEventListener('loadstart', handleEvent);
                    //reader.addEventListener('load', handleEvent);
                    //reader.addEventListener('loadend', handleEvent);
                    reader.addEventListener('progress', handleEvent);
                    //reader.addEventListener('error', handleEvent);
                    //reader.addEventListener('abort', handleEvent);
                }
                addListeners(reader);
                */
    		    reader.addEventListener("load", (e) => {
                    if(this.debug){
                        console.log('file reader loaded');
                    }
			        var finalFile = reader.result;
                    
                    finalFile = finalFile.substring(finalFile.indexOf(',') + 1);
			        //console.log(finalFile);
                    
                    window.API.postJson(
      		        	`/extensions/power-settings/api/save`,
                        {'action':'upload', 'filename':filename, 'filedata': finalFile, 'parts_total':1, 'parts_current':1} //e.target.result

      			      ).then((body) => {
                            if(this.debug){
                                console.log("file upload done. Response: ", body);
                            }
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
      					    console.log("power settings: Error uploading file: ", e);
                            document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<p>Error, could not upload the file. It could just be a connection issue. Or perhaps the file is too big (maximum size is 10Mb).</p>';    
      			      });
                    
    		    }); 

    		    reader.readAsDataURL( files[0] );
    	  	}
    	}
		
		
		
		start_partition_expansion(){
			if(this.debug){
				console.log("power settings: starting partition expansion");
			}
			if(document.getElementById("extension-power-settings-busy-expanding-user-partition") != null){
				document.getElementById("extension-power-settings-busy-expanding-user-partition").style.display = 'block';
			}
            
            //document.getElementById("extension-power-settings-expand-user-partition-explanation").style.display = 'none';
			if(document.getElementById("extension-power-settings-user-partition-expansion-hint") != null){
				document.getElementById("extension-power-settings-user-partition-expansion-hint").style.display = 'none';
			}
			
			//document.getElementById("extension-power-settings-user-partition-expansion-button").style.display = 'none';
			
            document.getElementById('connectivity-scrim').classList.remove('hidden');
			
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'expand_user_partition'
                }
            ).then((body) => {
                if(this.debug){
                    console.log("expand_user_partition response: ", body);
                }
                //console.log("expand_user_partition response: ", body);
        
                if(typeof body.state != 'undefined'){
                    if(body.state == false){
                        document.getElementById("extension-power-settings-busy-expanding-user-partition").style.display = 'none';
                        //document.getElementById("extension-power-settings-expand-user-partition-explanation").style.display = 'block';
                        alert("Error, disk expansion could not be started");
						document.getElementById('connectivity-scrim').classList.add('hidden');
                    }
                }
        
            }).catch((e) => {
                console.error("Error requesting expand user partition: ", e);
            });
		}
		
		
		
		
		show_display_page(){
			
			document.getElementById('extension-power-settings-no-display').classList.add('extension-power-settings-hidden');
			document.getElementById('extension-power-settings-display1-info').classList.add('extension-power-settings-hidden');
			document.getElementById('extension-power-settings-display2-info').classList.add('extension-power-settings-hidden');
			document.getElementById('extension-power-settings-display1-production-date').innerText = '';
			document.getElementById('extension-power-settings-display2-production-date').innerText = '';
			
			function get_production_time(week, year) { 
				//console.log("get_production_time: ", typeof week, week, typeof year, year);
				year = '' + year;
				if(typeof year == 'string' && year.length == 4){
					let months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
					let month = months[ Math.floor(parseInt(week)/4.33333) ];	
					return 'Produced in ' + month + ' ' + year;
				}
				return '';
			}
			
			
			window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'display_init'
                }
            ).then((body) => {
                if(this.debug){
                    console.log("display init response: ", body);
                }
				
				if(typeof body.display_port1_name != 'undefined'){
					this.display_port1_name = body.display_port1_name;
				}
				if(typeof body.display_port2_name != 'undefined'){
					this.display_port2_name = body.display_port2_name;
				}
				
				// rotation
				if(typeof body.display1_rotated != 'undefined'){
					document.getElementById('extension-power-settings-display1-rotate-checkbox').checked = body.display1_rotated;
				}
				if(typeof body.display2_rotated != 'undefined'){
					document.getElementById('extension-power-settings-display2-rotate-checkbox').checked = body.display2_rotated;
				}
				
				// power management 
				if(typeof body.display1_power != 'undefined'){
					document.getElementById('extension-power-settings-display1-power-checkbox').checked = body.display1_power;
				}
				if(typeof body.display2_power != 'undefined'){
					document.getElementById('extension-power-settings-display2-power-checkbox').checked = body.display2_power;
				}
				
				// Show the display's width and height
				if(typeof body.display1_width != 'undefined' && typeof body.display1_height != 'undefined' && typeof body.display2_width != 'undefined' && typeof body.display2_height != 'undefined'){
					
					document.getElementById('extension-power-settings-display1-resolution-container').innerHTML = '<span class="extension-power-settings-key-label">Width:</span> <span id="extension-power-settings-display1-width">' + body.display1_width + '</span><br/><span class="extension-power-settings-key-label">Height:</span> <span id="extension-power-settings-display1-height">' + body.display1_width + '</span><br/>';
					document.getElementById('extension-power-settings-display2-resolution-container').innerHTML = '<span class="extension-power-settings-key-label">Width:</span> <span id="extension-power-settings-display2-width">' + body.display2_width + '</span><br/><span class="extension-power-settings-key-label">Height:</span> <span id="extension-power-settings-display2-height">' + body.display2_width + '</span><br/>';
					//document.getElementById('extension-power-settings-display1-width').innerText = body.display1_width;
					//document.getElementById('extension-power-settings-display1-height').innerText = body.display1_height;
					//document.getElementById('extension-power-settings-display2-width').innerText = body.display2_width;
					//document.getElementById('extension-power-settings-display2-height').innerText = body.display2_height;
					if(body.display1_width == 0 && body.display2_width == 0){
						document.getElementById('extension-power-settings-no-display').classList.remove('extension-power-settings-hidden');
					}
					if(body.display1_width != 0){
						document.getElementById('extension-power-settings-display1-info').classList.remove('extension-power-settings-hidden');
						if(typeof body.touchscreen_detected != 'undefined' && body.display2_width == 0){
							if(body.touchscreen_detected){
								document.getElementById('extension-power-settings-display1-production-date').innerHTML = 'Touch screen<br/>';
							}
						}
					}
					if(body.display2_width != 0){
						document.getElementById('extension-power-settings-display2-info').classList.remove('extension-power-settings-hidden');
						if(typeof body.touchscreen_detected != 'undefined' && body.display1_width == 0){
							if(body.touchscreen_detected){
								document.getElementById('extension-power-settings-display2-production-date').innerHTML = 'Touch screen<br/>';
							}
						}
					}
				}
				
				// Show the dispay's standby delay in minutes
				if(typeof body.display_standby_delay != 'undefined'){
					document.getElementById('extension-power-settings-display1-standby-delay').innerText = parseInt(body.display_standby_delay) / 60;
					document.getElementById('extension-power-settings-display2-standby-delay').innerText = parseInt(body.display_standby_delay) / 60;
				}
				
				if(typeof body.rpi_display_backlight != 'undefined' && typeof body.rpi_display_rotation != 'undefined'){
					if(body.rpi_display_backlight){
						document.getElementById('extension-power-settings-rpi-display-info').classList.remove('extension-power-settings-hidden');
						if(parseInt(body.rpi_display_rotation) == 180){
							if(this.debug){
								console.log("official Rpi Display detected, and seems to be rotated");
							}
							document.getElementById('extension-power-settings-rpi-display-rotate-checkbox').checked = true;
						}
						else{
							if(this.debug){
								console.log("official Rpi Display detected, does not seem to be rotated");
							}
							document.getElementById('extension-power-settings-rpi-display-rotate-checkbox').checked = false;
						}
						
					}
					else{
						if(this.debug){
							console.log("No Rpi Display detected");
						}
						document.getElementById('extension-power-settings-rpi-display-info').classList.add('extension-power-settings-hidden')
					}
				}
				
				
				// TODO: make all this less clunky. Right now it's two parts of code repeated..
				
				// Show EDID display details
				if(typeof body.display1_details != 'undefined'){
					document.getElementById('extension-power-settings-display1-details').innerHTML = '';
					if(body.display1_details != ''){
						try{
							let disp_details = JSON.parse(body.display1_details);
							if(this.debug){
								console.log("disp_details : ", disp_details);
							}
							try{
								if(typeof disp_details['week'] != 'undefined' && typeof disp_details['year'] != 'undefined'){
									document.getElementById('extension-power-settings-display1-production-date').innerHTML += get_production_time(disp_details['week'], disp_details['year']);
								}
								
								if(typeof disp_details['manufacturer'] != 'undefined' && typeof disp_details['name'] != 'undefined'){
									console.log("display manufacturer and name are available");
									
									if(disp_details['manufacturer'].indexOf('DO NOT USE') != -1){
										disp_details['manufacturer'] = 'Unknown manufacturer'
									}
									
									document.getElementById('extension-power-settings-display1-name').innerText = disp_details['manufacturer'] + ' - ' + disp_details['name'];
								}
								
								//console.log("registry: ", window.extension_power_settings_display_registry);
								//console.log("manufacturer_pnp_id: ", disp_details['manufacturer_pnp_id']);
								/*
								if(typeof disp_details['manufacturer_pnp_id'] != 'undefined' && typeof window.extension_power_settings_display_registry != 'undefined'){
									//console.log("manufacturer_pnp_id and registry exist");
									if(typeof window.extension_power_settings_display_registry[ disp_details['manufacturer_pnp_id'].trim() ] != 'undefined'){
										//info_value = window.extension_power_settings_display_registry[ disp_details['manufacturer_pnp_id'] ] + ' (' + info_value + ')';
										
										if(typeof disp_details['name'] != 'undefined' && disp_details['name'].length){
											document.getElementById('extension-power-settings-display1-name').innerText = window.extension_power_settings_display_registry[ disp_details['manufacturer_pnp_id'] ] + ', ' + disp_details['name'];
										}
										else{
											console.warn("no valid display name found in EDID data: ", typeof disp_details['name'], disp_details['name']);
										}
									}
									else{
										console.warn("manufacturer_pnp_id was not found in registry: ", disp_details['manufacturer_pnp_id'], window.extension_power_settings_display_registry);
									}
								}
								*/
								
							}
							catch(e){
								console.log("Error calculating display production date / generating display name: ", e);
							}
							
							
							
							
							// Add info key-value pairs
							let info_container_el = document.createElement("ul");
							info_container_el.classList.add('extension-power-settings-list-item-info');
							
							
							
							for (const [info_key, info_value] of Object.entries(disp_details)) {
								let info_el = document.createElement("li");
							
								let info_key_el = document.createElement("span");
								info_key_el.classList.add('extension-power-settings-list-item-info-key');
								info_key_el.innerText = info_key;
								info_el.appendChild(info_key_el);
								
								let info_value_el = document.createElement("span");
								info_value_el.classList.add('extension-power-settings-list-item-info-value');
								
								
								if(info_key == 'resolutions' && typeof info_value == 'object'){
									console.log("spotted resolutions. info_value", typeof(info_value), info_value);
									
									let select_container_el = document.createElement("div");
									select_container_el.classList.add('extension-power-settings-flex-centered-spaced');
									select_container_el.innerHTML = '<span style="padding-right: 2rem;box-sizing:border-box;display:inline-block;">Resolution: </span>';
									
									let select_el = document.createElement("select");
									select_el.setAttribute('id','extension-power-settings-display1-resolution-select');
									select_el.classList.add('localization-select');
									
									let choose_option_el = document.createElement("option");
									choose_option_el.value = 'default';
									choose_option_el.innerText = "Default";
									select_el.appendChild(choose_option_el);
									
									//select_el.onChange = function(element){
									//	console.log("changing resolution to: ", element.value);
									//}
									select_el.addEventListener('change', (event) => {
										//console.log("changing resolution to: ", event.target.value);
										if(event.target.value.indexOf('x') != -1 || event.target.value == 'default'){
											this.set_display_resolution(this.display_port1_name,event.target.value);
										}
									});
									
									var added_resolutions = 0;
									try{
										for (var r = 0; r < info_value.length; r++) {
											if(info_value[r][2] != '60'){
												if(this.debug){
													console.warn("power settings: skipping non-60Hz display refresh rate: ", info_value[r][2]);
												}
												continue
											}
											let option_el = document.createElement("option");
											option_el.value = option_el.innerText = info_value[r][0] + 'x' + info_value[r][1]; // + '_' + resolution_parts[r];
											//console.log(body.display1_width, " =?= ", info_value[r][0], "   &   ", body.display1_height, " =?= ", info_value[r][1]);
											
											if(body.display1_width == info_value[r][0] && body.display1_height == info_value[r][1]){
												//console.log("at the current resolution");
												option_el.selected = true;
											}
											
											added_resolutions++; 
											select_el.appendChild(option_el);
											//let option_text = resolution_parts[r] + 'x' + resolution_parts[r + 1];// + ', ' + resolution_parts[r+2] +'Hz';

										}
										if(added_resolutions > 1){
											document.getElementById('extension-power-settings-display1-resolution-container').innerHTML = '';
											
											select_container_el.appendChild(select_el);
											
											document.getElementById('extension-power-settings-display1-resolution-container').appendChild(select_container_el);
										}
									}
									catch(e){
										console.error("error parsing edid resolutions: ", e);
									}
									
									
									for (var r = 0; r < info_value.length; r++) {
										info_value_el.innerHTML += '<span>' + info_value[r] + '</span><br/>';
									}
									
									//info_el.appendChild(info_value_el);
							
									//info_container_el.appendChild(info_el);
									
									
								}
								else{
									info_value_el.innerText = info_value;
								}
								
								info_el.appendChild(info_value_el);
								
								info_container_el.appendChild(info_el);
								
							
								
							}
							document.getElementById('extension-power-settings-display1-details').appendChild(info_container_el);
						}
						catch(e){
							console.error("unable to parse display EDID data: ", e);
						}
					}
					else{
						document.getElementById('extension-power-settings-display1-details').innerHTML = '<p>No details available</p>';
					}
				}
				
				
				// Show EDID display details
				if(typeof body.display2_details != 'undefined'){
					document.getElementById('extension-power-settings-display2-details').innerHTML = '';
					if(body.display2_details != ''){
						try{
							let disp_details = JSON.parse(body.display2_details);
							if(this.debug){
								console.log("disp_details : ", disp_details);
							}
							try{
								if(typeof disp_details['week'] != 'undefined' && typeof disp_details['year'] != 'undefined'){
									document.getElementById('extension-power-settings-display2-production-date').innerText = get_production_time(disp_details['week'], disp_details['year']);
								}
								
								if(typeof disp_details['manufacturer'] != 'undefined' && typeof disp_details['name'] != 'undefined'){
									console.log("display manufacturer and name are available");
									
									if(disp_details['manufacturer'].indexOf('DO NOT USE') != -1){
										disp_details['manufacturer'] = 'Unknown manufacturer'
									}
									
									document.getElementById('extension-power-settings-display2-name').innerText = disp_details['manufacturer'] + ' - ' + disp_details['name'];
								}
								
								//console.log("registry: ", window.extension_power_settings_display_registry);
								//console.log("manufacturer_pnp_id: ", disp_details['manufacturer_pnp_id']);
								/*
								if(typeof disp_details['manufacturer_pnp_id'] != 'undefined' && typeof window.extension_power_settings_display_registry != 'undefined'){
									//console.log("manufacturer_pnp_id and registry exist");
									if(typeof window.extension_power_settings_display_registry[ disp_details['manufacturer_pnp_id'].trim() ] != 'undefined'){
										//info_value = window.extension_power_settings_display_registry[ disp_details['manufacturer_pnp_id'] ] + ' (' + info_value + ')';
										
										if(typeof disp_details['name'] != 'undefined' && disp_details['name'].length){
											document.getElementById('extension-power-settings-display2-name').innerText = window.extension_power_settings_display_registry[ disp_details['manufacturer_pnp_id'] ] + ', ' + disp_details['name'];
										}
										else{
											console.warn("no valid display name found in EDID data: ", typeof disp_details['name'], disp_details['name']);
										}
									}
									else{
										console.warn("manufacturer_pnp_id was not found in registry: ", disp_details['manufacturer_pnp_id'], window.extension_power_settings_display_registry);
									}
								}
								*/
								
							}
							catch(e){
								console.log("Error calculating display production date / generating display name: ", e);
							}
							
							
							
							
							// Add info key-value pairs
							let info_container_el = document.createElement("ul");
							info_container_el.classList.add('extension-power-settings-list-item-info');
							
							for (const [info_key, info_value] of Object.entries(disp_details)) {
								let info_el = document.createElement("li");
							
								let info_key_el = document.createElement("span");
								info_key_el.classList.add('extension-power-settings-list-item-info-key');
								info_key_el.innerText = info_key;
								info_el.appendChild(info_key_el);
								
								let info_value_el = document.createElement("span");
								info_value_el.classList.add('extension-power-settings-list-item-info-value');
								
								
								if(info_key == 'resolutions' && typeof info_value == 'object'){
									if(this.debug){
										console.log("power settings: spotted resolutions. info_value", typeof(info_value), info_value);
									}
									let select_container_el = document.createElement("div");
									select_container_el.classList.add('extension-power-settings-flex-centered-spaced');
									select_container_el.innerHTML = '<span style="padding-right: 2rem;box-sizing:border-box;display:inline-block;">Resolution: </span>';
									
									let select_el = document.createElement("select");
									select_el.setAttribute('id','extension-power-settings-display2-resolution-select');
									select_el.classList.add('localization-select');
									
									let choose_option_el = document.createElement("option");
									choose_option_el.value = 'default';
									choose_option_el.innerText = "Default";
									select_el.appendChild(choose_option_el);
									
									//select_el.onChange = function(element){
									//	console.log("changing resolution to: ", element.value);
									//}
									select_el.addEventListener('change', (event) => {
										//console.log("changing resolution to: ", event.target.value);
										if(event.target.value.indexOf('x') != -1 || event.target.value == 'default'){
											this.set_display_resolution(this.display_port2_name,event.target.value);
										}
									});
									
									var added_resolutions = 0;
									try{
										for (var r = 0; r < info_value.length; r++) {
											if(info_value[r][2] != '60'){
												if(this.debug){
													console.warn("power settings: skipping non-60Hz display refresh rate: ", info_value[r][2]);
												}
												continue
											}
											let option_el = document.createElement("option");
											option_el.value = option_el.innerText = info_value[r][0] + 'x' + info_value[r][1]; // + '_' + resolution_parts[r];
											//console.log(body.display2_width, " =?= ", info_value[r][0], "   &   ", body.display2_height, " =?= ", info_value[r][1]);
											
											if(body.display2_width == info_value[r][0] && body.display2_height == info_value[r][1]){
												//console.log("at the current resolution");
												option_el.selected = true;
											}
											
											added_resolutions++; 
											select_el.appendChild(option_el);
											//let option_text = resolution_parts[r] + 'x' + resolution_parts[r + 1];// + ', ' + resolution_parts[r+2] +'Hz';

										}
										if(added_resolutions > 1){
											document.getElementById('extension-power-settings-display2-resolution-container').innerHTML = '';
											
											select_container_el.appendChild(select_el);
											
											document.getElementById('extension-power-settings-display2-resolution-container').appendChild(select_container_el);
										}
									}
									catch(e){
										console.error("error parsing edid resolutions: ", e);
									}
									
									
									for (var r = 0; r < info_value.length; r++) {
										info_value_el.innerHTML += '<span>' + info_value[r] + '</span><br/>';
									}
									
									//info_el.appendChild(info_value_el);
							
									//info_container_el.appendChild(info_el);
									
									
								}
								else{
									info_value_el.innerText = info_value;
								}
								
								info_el.appendChild(info_value_el);
								
								info_container_el.appendChild(info_el);
								
							
								
							}
							document.getElementById('extension-power-settings-display2-details').appendChild(info_container_el);
						}
						catch(e){
							console.error("unable to parse display EDID data: ", e);
						}
					}
					else{
						document.getElementById('extension-power-settings-display2-details').innerHTML = '<p>No details available</p>';
					}
				}
				
				
				
            }).catch((e) => {
                console.error("Error sending get_display_info command: ", e);
            });
		}
		
		
		
		set_display_resolution(port,resolution){
			//console.log("power settings: in set_display_resolution: ", port, resolution);
			
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'set_display_resolution',
					'port':port,
					'resolution':resolution
                }
            ).then((body) => {
                if(this.debug){
                    console.log("set_display_resolution response: ", body);
                }
            }).catch((e) => {
                console.error("Error changing display resolution: ", e);
            });
		}
		
		
		
		
		show_printer_page(){
			document.getElementById('extension-power-settings-general-printing-container').classList.add('extension-power-settings-hidden');
			const printer_list_el = document.getElementById('extension-power-settings-printers-list-container');
			if(printer_list_el){
				printer_list_el.innerHTML = '<div class="extension-power-settings-spinner"><div></div><div></div><div></div><div></div></div>';
				
				window.API.postJson(
	                `/extensions/${this.id}/api/ajax`, {
	                    'action': 'printer'
	                }
	            ).then((body) => {
	                if(this.debug){
	                    console.log("printer init response: ", body);
	                }
				
					// Printing
					if(typeof body.printing_allowed != 'undefined'){
						this.printing_allowed = body.printing_allowed; 
						document.getElementById('extension-power-settings-allow-printing-checkbox').checked = body.printing_allowed;
						document.getElementById('extension-power-settings-general-printing-container').classList.remove('extension-power-settings-hidden');
					}
				
					if(typeof body.connected_printers != 'undefined'){
						this.connected_printers = body.connected_printers;
						//printer_list_el.innerHTML = '<pre>' + body.connected_printers + '</pre>';
						this.generate_connected_printers_list();
					}
				
	            }).catch((e) => {
	                console.error("power settings error:  show printer page: ", e);
	            });
			}
		}
		
		
		
		generate_connected_printers_list(){
			if(this.debug){
				console.log("power settings: in generate_connected_printers_list. this.connected_printers: ", this.connected_printers);
			}
			try{
				
				const printer_list_el = document.getElementById('extension-power-settings-printers-list-container');
				printer_list_el.innerHTML = '';
				
				for (const [key, printer] of Object.entries(this.connected_printers)) {
				
					const printer_name = printer.id;
					if(this.debug){
						console.log("power settings: adding printer to list: ", printer_name);
					}
					var default_printer_html = '';
				
					if(printer.default == true){
						default_printer_html = '<div class="extension-power-settings-printer-item-default">DEFAULT</div>'
					}
					let printer_item_el = document.createElement('div');
					printer_item_el.classList.add('extension-power-settings-printer-item');
					printer_item_el.innerHTML = default_printer_html + '<h4>' + printer.id.replaceAll('_',' ') + '</h4><a href="http://' + printer.ip + '" rel="noreferrer" target="_blank">' + printer.ip + '</a>';
				
					if(printer.default == false){
				
						let set_as_default_button_el = document.createElement('button');
						set_as_default_button_el.classList.add('text-button');
						set_as_default_button_el.innerText = 'Set as default';
						set_as_default_button_el.addEventListener('click', () => {
							if(this.debug){
								console.log("power settings: setting as default printer: ", printer_name);
							}
							printer_list_el.innerHTML = '<div class="extension-power-settings-spinner"><div></div><div></div><div></div><div></div></div>';
		                    window.API.postJson(
		                        `/extensions/${this.id}/api/ajax`, {
		                            'action': 'printer',
									'default_printer':printer_name
		                        }
		                    ).then((body) => {
		                        if(this.debug){
		                            console.log("power settings: change default printer response: ", body);
		                        }
							
								// Printing
								if(typeof body.printing_allowed != 'undefined'){
									this.printing_allowed = body.printing_allowed; 
									document.getElementById('extension-power-settings-allow-printing-checkbox').checked = body.printing_allowed;
									if(this.printing_allowed){
										document.body.classList.add('cups-printing');
									}else{
										document.body.classList.remove('cups-printing');
									}
								}
				
								if(typeof body.connected_printers != 'undefined'){
									this.connected_printers = body.connected_printers;
									//printer_list_el.innerHTML = '<pre>' + body.connected_printers + '</pre>';
									this.generate_connected_printers_list();
								}
							
		                    }).catch((e) => {
		                       console.error("Error: power settings: change default printer failed: ", e);
		                    });
	        			});
				
						printer_item_el.appendChild(set_as_default_button_el);
					}
				
					printer_list_el.appendChild(printer_item_el);
				
				}
			}
			catch(e){
				console.error("power settings: error generating printers list: ", e);
			}
			
		}
		
		
		
		
		
		get_stats(){
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'get_stats'
                }
            ).then((body) => {
                //console.log("get stats response: ", body);
                if(this.debug){
                    console.log("power settings: get stats response: ", body);
                }            

                // Show the total memory
                if(typeof body['total_memory'] != 'undefined'){
                    document.getElementById('extension-power-settings-total-memory').innerText = body['total_memory'];
                
					let total_memory = parseInt(body['total_memory']);
	                if(this.debug){
	                    console.log("power settings: total_memory: ", total_memory);
	                }     
					if(total_memory > 600){
						document.getElementById('extension-power-settings-device-model-memory').innerText = Math.round(total_memory/1000 ) + 'GB ';
					}
					else{
						document.getElementById('extension-power-settings-device-model-memory').innerText = '500MB';
					}
					
					if(typeof body['sd_card_written_kbytes'] != 'undefined'){
						document.getElementById('extension-power-settings-sd-card-written-bytes').innerText = body['sd_card_written_kbytes'];
					}

	                // Show the available memory. This is different from "free" memory
	                if(typeof body['available_memory'] != 'undefined'){
	                    document.getElementById('extension-power-settings-available-memory').innerText = body['available_memory'];
						
		                // Show the free memory.
		                if(typeof body['free_memory'] != 'undefined'){
		                    document.getElementById('extension-power-settings-free-memory').innerText = body['free_memory'];
							
							
							let total_mem = parseFloat(body['total_memory']);
							let avail_mem = parseFloat(body['available_memory']);
							let free_mem = parseFloat(body['free_memory']);
							
							let low_mem_el = document.getElementById('extension-power-settings-low-memory-warning');
						
							if(low_mem_el){
			                    if(free_mem < 100){
			                        low_mem_el.style.display = 'block';
			                    }
			                    if(free_mem < 50){
			                        low_mem_el.style.background = 'red';
			                    }
							}
							
							
							let used_mem = ( (total_mem - avail_mem) / total_mem) * 100;
							if(this.debug){
								console.log("power settings: used_mem: ", used_mem);
							}
							let purgeable_mem = ( (avail_mem-free_mem) / total_mem) * 100;
							if(this.debug){
								console.log("power settings: purgeable_mem: ", purgeable_mem);
							}
							document.getElementById('extension-power-settings-memory-used-bar').style.width = used_mem + '%';
							document.getElementById('extension-power-settings-memory-purgeable-bar').style.width = purgeable_mem + '%';
		                }
	                }
				
				
				}            
                
                
                
                // Show the total and available disk space
                if(typeof body['disk_usage'] != 'undefined'){
					
					const total_disk_space = Math.floor(body['disk_usage'][0] / 1024000);
                    const free_disk_space = Math.floor(body['disk_usage'][2] / 1024000);
					const used_disk_space = total_disk_space - free_disk_space;
					
                    document.getElementById('extension-power-settings-total-disk').innerText = total_disk_space;
                    document.getElementById('extension-power-settings-free-disk').innerText = free_disk_space;
                    
					let low_storage_el = document.getElementById('extension-power-settings-low-storage-warning');
					if(low_storage_el){
	                    if(free_disk_space < 1000){
	                        document.getElementById('extension-power-settings-low-storage-warning').style.display = 'block';
	                    }
                    
	                    if(free_disk_space < 500){
	                        document.getElementById('extension-power-settings-low-storage-warning').style.background = 'red';
	                    }
					}
					
					let used_disk_percentage = (used_disk_space / total_disk_space) * 100;
					if(this.debug){
						console.log("power settings: used_disk_percentage: ", used_disk_percentage);
					}
					document.getElementById('extension-power-settings-disk-used-bar').style.width = used_disk_percentage + '%';
                    
                }
				
                // Show attached devices
                if(typeof body['attached_devices'] != 'undefined'){
					
					this.attached_devices = body['attached_devices'];
					if(this.debug){
						console.log("this.attached_devices: ", this.attached_devices);
					}
					let attached_list_el = document.getElementById('extension-power-settings-attached-devices-list-container');
					
					var real_usb_devices_count = 0;
					if(attached_list_el){
	                    
						if(typeof this.attached_devices == 'object' && this.attached_devices.length){
							attached_list_el.innerHTML = '';
							for (var r = 0; r < this.attached_devices.length; r++) {
								let attached_item_el = document.createElement('div');
								if(this.attached_devices[r].endsWith(' Hub') || this.attached_devices[r].endsWith(' hub')){
									if(!this.debug){
										continue
									}
									else{
										attached_item_el.style.opacity = '.5';
									}
								}
								else{
									real_usb_devices_count++;
								}
								
								
								attached_item_el.classList.add('extension-power-settings-attached-item');
								attached_item_el.innerHTML = '<p>' + this.attached_devices[r] + '</p>';
								attached_list_el.appendChild(attached_item_el)
							}
						}
						
						if(real_usb_devices_count == 0){
							if(!document.body.classList.contains('developer')){
								attached_list_el.innerHTML = '<p>None</p>';
							}
						}
						
					}
					else{
						console.warn("power settings: usb devices list element not found");
					}
                    
                }
				
                
                // Show low voltage warning
                if(typeof body['low_voltage'] != 'undefined'){
                    if(body['low_voltage'] == true){
						let low_voltage_el = document.getElementById('extension-power-settings-low-voltage-warning');
						if(low_voltage_el){
							low_voltage_el.style.display = 'block';
						}
                        
                    }
                }
				
				
				
                
            
            }).catch((e) => {
                console.error("Error, power settings: get stats failed: could not connect to controller: ", e);
				this.get_stats_fail_counter = 6;
            });
		}
        
        
    }

    new PowerSettings();

})();