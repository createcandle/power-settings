(function() {
    class PowerSettings extends window.Extension {
        constructor() {
            super('power-settings');
            
            //this.addMenuEntry('Power');
            
            this.interval = null;
            
            document.querySelector('#main-menu> ul').insertAdjacentHTML('beforeend', '<li id="extension-power-settings-menu-item-li"><a id="extension-power-settings-menu-item" href="/extensions/power-settings">Power</a></li>');
            
            //console.log(window.API);

            this.debug = false;
			this.developer = false;
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

			
			//console.log('this.view: ', this.view);
			
			this.display_port1_name = 'HDMI-1';
			this.display_port2_name = 'HDMI-2';

			this.printing_allowed = false;
			this.connected_printers = {};
			
			this.attached_devices = [];
			this.attached_cameras = [];

			this.get_stats_interval = null;
			this.get_stats_fail_counter = 0;


			this.pipewire_enabled = false;
			this.pipewire_data = {};
			
			this.mouse_pointer_enabled = false;
			
			let addon_settings_link_el = document.getElementById('addon-settings-link');
			if(addon_settings_link_el){
				addon_settings_link_el.parentNode.classList.add('extension-power-settings-hidden');
			}
			setTimeout(() => {
				addon_settings_link_el = document.getElementById('addon-settings-link');
				if(addon_settings_link_el){
					addon_settings_link_el.parentNode.classList.add('extension-power-settings-hidden');
				}
			},1000);
			
			
			
			if(document.location.href.endsWith('/settings/network')){
	            window.API.postJson(
	                `/extensions/${this.id}/api/ajax`, {
	                    'action': 'get_hotspot_settings'
	                }
	            ).then((body) => {
	                this.render_hotspot_settings(body);
        
	            }).catch((err) => {
	                console.error("power-settings get_hotspot_details error: ", err);
	            });
			}
			
			document.getElementById('settings-menu').addEventListener('click', (event) => {

				if(event.target.tagName == 'A'){
					
					const menu_item_els = document.querySelectorAll('#settings-view section.settings-section');
					for(let mi = 0; mi < menu_item_els.length; mi++){
						console.log("hiding settings-section");
						menu_item_els[mi].classList.add('hidden');
					}
				
					if( event.target.parentNode.classList.contains('extension-power-settings-settings-item') ){
						// do nothing
					}
					else {
						console.log('hiding all extra settings containers');
						this.hide_all_settings_containers();
					}
				
					if(event.target.getAttribute('id') == 'network-settings-link'){
					
			            window.API.postJson(
			                `/extensions/${this.id}/api/ajax`, {
			                    'action': 'get_hotspot_settings'
			                }
			            ).then((body) => {
			                this.render_hotspot_settings(body);
            
			            }).catch((err) => {
			                console.error("power-settings get_hotspot_details error: ", err);
			            });
					}
					
				}
				else{
					console.log("clicked in between buttons?");
				}
				
			});
			
			/*
			const network_settings_link_el = document.getElementById('network-settings-link');
			if(network_settings_link_el){
				console.log("power-settings: adding listener to network_settings_link_el");
				
				network_settings_link_el.addEventListener('click', () => {
	            	
				});
			}
			else{
				console.error("power-settings: network_settings_link_el does not exist (yet)");
			}
			*/
			
			
			
			
			

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
			const close_browser = document.getElementById('extension-power-settings-close-browser');
			
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
            
			if(close_browser){
	            close_browser.addEventListener('click', () => {
					console.log("closing browser");
	                window.API.postJson(
	                    `/extensions/${this.id}/api/close_browser`, {}
	                )
	            });
			}
			
			
            
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














		//
		//  CREATE EXTRA SETTINGS BUTTONS IN SETTINGS MENU
		//


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
				
				
				
				
                //
				//  EXTRA BUTTONS
				//
                
                // Add buttons to settings menu
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item"><a id="extension-power-settings-menu-time-button">Clock</a></li>';
				document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item"><a id="extension-power-settings-menu-display-button">Display</a></li>';
				document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item" id="extension-power-settings-main-menu-audio-item"><a id="extension-power-settings-menu-audio-button">Audio</a></li>';
				document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item" id="extension-power-settings-main-menu-printer-item" style="display:none"><a id="extension-power-settings-menu-printer-button">Printer</a></li>';
				document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item"><a id="extension-power-settings-menu-system-button">System Information</a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item"><a id="extension-power-settings-menu-backup-button">Backup & Restore</a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item"><a id="extension-power-settings-menu-update-button">Update <span id="extension-power-settings-menu-update-button-indicator">' + this.update_available_text + '</span></a></li>';
                document.querySelector('#settings-menu > ul').innerHTML += '<li class="settings-item extension-power-settings-settings-item"><a id="extension-power-settings-menu-reset-button">Factory reset</a></li>';
                
                
                
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
				
				
                // Show audio page button
                document.getElementById('extension-power-settings-menu-audio-button').addEventListener('click', () => {
                    this.hide_all_settings_containers();
                    document.getElementById('extension-power-settings-container-audio').classList.remove('extension-power-settings-hidden');
                    document.getElementById('extension-power-settings-pages').classList.remove('hidden');
                    
                    this.show_audio_page();
                    
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
				
				// test speakers button
                document.getElementById('extension-power-settings-test-speakers-button').addEventListener('click', () => {
					console.log("clicked on test speaker button");
					
                    document.getElementById('extension-power-settings-test-speakers-button').setAttribute("disabled", true); //.classList.add('extension-power-settings-hidden');
                    /*
					setTimeout(() => {
                    	document.getElementById('extension-power-settings-test-speakers-button').removeAttribute("disabled"); //.classList.remove('extension-power-settings-hidden');
                    },5000);
					*/
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'test_speakers'
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("power settings: speaker test complete: ", body);
                        }
						document.getElementById('extension-power-settings-test-speakers-button').removeAttribute("disabled");
                    }).catch((e) => {
                       console.error("Error: speaker test connection failed: ", e);
					   document.getElementById('extension-power-settings-test-speakers-button').removeAttribute("disabled");
					   alert("Could not connect to controller");
                    });
                });
				
				
				// reinstall candle app store button
                document.getElementById('extension-power-settings-reinstall-candleappstore-button').addEventListener('click', () => {
					if(confirm("Are you sure?")){
	                    document.getElementById('extension-power-settings-reinstall-candleappstore-button').classList.add('extension-power-settings-hidden');
						document.getElementById('extension-power-settings-reinstall-candleappstore-failed-container').classList.add('extension-power-settings-hidden');
						document.getElementById('extension-power-settings-reinstall-candleappstore-busy-container').classList.remove('extension-power-settings-hidden');
					
	                    window.API.postJson(
	                        `/extensions/${this.id}/api/ajax`, {
	                            'action': 'reinstall_app_store'
	                        }
	                    ).then((body) => {
	                        if(this.debug){
	                            console.log("power settings: reinstall_app_store reponse: ", body);
	                        }
							if(typeof body.state != 'undefined'){
								if(body.state == true){
									if(this.debug){
										console.log("Updating to latest version of Candle appstore seems to have been succcesfull");
									}
									document.getElementById('extension-power-settings-reinstall-candleappstore-container').style.background="green";
									setTimeout(() => {
										window.location.reload(true); 
									},15000);
								}
								else{
									document.getElementById('extension-power-settings-reinstall-candleappstore-container').style.background="red";
									document.getElementById('extension-power-settings-reinstall-candleappstore-failed-container').classList.remove('extension-power-settings-hidden');
									document.getElementById('extension-power-settings-reinstall-candleappstore-busy-container').classList.add('extension-power-settings-hidden');
									document.getElementById('extension-power-settings-reinstall-candleappstore-button').classList.remove('extension-power-settings-hidden');
								}
							}
							else{
								console.error("candleappstore: reinstall_app_store: body.state was undefined? body: ", body);
							}
						
						
	                    }).catch((e) => {
	                    	console.error("Error: reinstall_app_store connection failed: ", e);
						    //document.getElementById('extension-power-settings-reinstall-candleappstore-button').classList.remove('extension-power-settings-hidden');
						    //alert("Could not connect to controller");
							setTimeout(() => {
								window.location.reload(true); 
							},15000);
	                    });
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
                            console.log("power settings debug: backup init response: ", body);
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
                
                
				
				// Show or hide mouse pointer
				const mouse_pointer_checkbox_el = document.getElementById('extension-power-settings-show-mouse-pointer');
                mouse_pointer_checkbox_el.addEventListener('change', () => {
                    
                    window.API.postJson(
                        `/extensions/${this.id}/api/ajax`, {
                            'action': 'set_mouse_pointer', 'mouse_pointer_enabled': mouse_pointer_checkbox_el.checked
                        }
                    ).then((body) => {
                        if(this.debug){
                            console.log("set_mouse_pointer response: ", body);
                        }
						//console.log("set_mouse_pointer response: ", body);
						document.getElementById('extension-power-settings-show-mouse-pointer-hint').classList.remove('extension-power-settings-hidden');
                        
                    }).catch((err) => {
                        console.error("caught error while trying to set mouse pointer preference: ", err);
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

        
		
		
		
		
		
		
		
		
		
		
		
		
		
		//
		//   INIT
		//
		
		get_init(){
            window.API.postJson(
                `/extensions/${this.id}/api/init`, {
                    'init': 1
                }
            ).then((body) => {
                this.handle_init(body);
                
            }).catch((e) => {
                console.error("power-settings init error: ", e);
            });
		}
        
        
		handle_init(body){
			
            const hours = document.getElementById('extension-power-settings-form-hours');
            const minutes = document.getElementById('extension-power-settings-form-minutes');
            const ntp = document.getElementById('extension-power-settings-form-ntp');
			
            // If the Candle overlay was active, then it shouldn't be anymmore.
            document.getElementById('candle-tools').style.display = 'none';
			
            if(typeof body.debug != 'undefined'){
                this.debug = body.debug;
				if(this.debug){
					console.log("power settings debug: handle_init: debugging enabled. init response: ", body);
				}
            }
            else{
                console.error("power settings: handle_init: init response: body.debug was undefined. Body: ", body);
				if(this.second_init_attempted == false){
					console.warn("power settings: will attempt power settings init again in 10 seconds");
					setTimeout(() => {
						this.second_init_attempted = true
						this.get_init();
					},10000);
					return
				}
            }
            
            
            // Does the recovery partition exist?
            if(typeof body.recovery_partition_exists != 'undefined'){
                this.recovery_partition_exists = body.recovery_partition_exists;
                if(this.debug){
                    console.log('power settings debug: this.recovery_partition_exists: ', this.recovery_partition_exists);
                }
                if(this.recovery_partition_exists == false){
                    if(this.debug){
                        console.log('power settings debug: there is no recovery partition');
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
                    console.log("power settings debug: system bits: ", this.bits);
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
			
			// temperature
            if(typeof body.board_temperature != 'undefined'){
                if(this.debug){
                    console.log("power settings debug: board_temperature: ", body.board_temperature);
                }
                document.getElementById('extension-power-settings-device-temperature').innerText = body.board_temperature;
            }
			
			
			// Linux version
            if(typeof body.device_linux != 'undefined'){
                if(this.debug){
                    console.log("power settings debug: device_linux: ", body.device_linux);
                }
                document.getElementById('extension-power-settings-device-linux').innerText = body.device_linux;
				if(body.device_kernel != ''){
					document.getElementById('extension-power-settings-device-kernel').innerText = body.device_kernel;
				}
            }
			
			// Kernel version
            if(typeof body.device_kernel != 'undefined'){
                if(this.debug){
                    console.log("power settings: device_kernel: ", body.device_kernel);
                }
				if(body.device_kernel != ''){
					document.getElementById('extension-power-settings-device-kernel').innerText = body.device_kernel;
				}
            }
			
			// SD Card size
            if(typeof body.device_sd_card_size != 'undefined'){
                if(this.debug){
                    console.log("power settings: device_sd_card_size: ", body.device_sd_card_size);
                }
				if(body.device_sd_card_size != null && parseInt(body.device_sd_card_size) > 1000000){
					if(document.getElementById('extension-power-settings-device-sd-card-size')){
						document.getElementById('extension-power-settings-device-sd-card-size').textContent = Math.round(parseInt(body.device_sd_card_size) / 1000000000) + "GB";
					}
				}
            }
			
            
			// Exhiit mode
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
						console.log("power settings debug: user partition not yet expanded");
					}
                    if(document.getElementById('extension-power-settings-user-partition-expansion-hint') != null){
						document.getElementById('extension-power-settings-user-partition-expansion-hint').style.display = 'block';
                    }
                }
				else{
					if(this.debug){
						console.log("power settings: user partition seems to be fully expanded");
					}
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
						console.log("power settings: printing via CUPS is supported");
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
			
            if(typeof body.pipewire_enabled != 'undefined'){
				if(body.pipewire_enabled){
					document.body.classList.add('pipewire');
				}
				this.pipewire_enabled = body.pipewire_enabled;
            }
			
			if(typeof body.mouse_pointer_enabled == 'boolean'){
				this.mouse_pointer_enabled = body.mouse_pointer_enabled;
			}
			
			this.render_hotspot_settings(body);
			
		}
		
		
        render_hotspot_settings(body){
			if(this.debug){
				console.log("power settings debug: in render_hotspot_settings. body: ", body);
			}
            if(typeof body.hotspot_enabled == 'boolean' && typeof body.hotspot_ssid == 'string' && typeof body.hotspot_password == 'string'){

				this.hotspot_enabled = body.hotspot_enabled;
				this.hotspot_ssid = body.hotspot_ssid;
				this.hotspot_password = body.hotspot_password;
				this.hotspot_connected_devices = body.hotspot_connected_devices;
				
				if(body.hotspot_enabled){
					document.body.classList.add('hotspot');
				}
				
				const network_settings_list_el = document.querySelector('#network-settings-client > ul.network-settings-list');
				if(network_settings_list_el){
					let hotspot_settings_container_el = network_settings_list_el.querySelector('#extension-power-settings-hotspot-container');
					if(hotspot_settings_container_el == null){
						let hotspot_settings_list_item_el = document.createElement('li');
						hotspot_settings_list_item_el.setAttribute('id','extension-power-settings-hotspot-container');
						hotspot_settings_list_item_el.classList.add('network-item');
						
						let hotspot_settings_container_el = document.createElement('div');
						
						const hotspot_image_el = document.createElement('img');
						hotspot_image_el.classList.add('network-settings-list-item-icon');
						hotspot_image_el.setAttribute('src','/extensions/power-settings/images/hotspot_shield.svg');
						hotspot_image_el.setAttribute('alt','Candle hotspot');
						
						hotspot_settings_container_el.appendChild(hotspot_image_el);
						
						const hotspot_details_el = document.createElement('div');
						hotspot_details_el.classList.add('network-settings-list-item-container-4');
						
						const hotspot_details_header_el = document.createElement('div');
						hotspot_details_header_el.classList.add('network-settings-list-item-header');
						hotspot_details_header_el.textContent = 'Hotspot';
						hotspot_details_el.appendChild(hotspot_details_header_el);
						
						const hotspot_details_ssid_el = document.createElement('div');
						hotspot_details_ssid_el.classList.add('network-settings-list-item-detail');
						hotspot_details_ssid_el.textContent = '' + body.hotspot_ssid;
						hotspot_details_el.appendChild(hotspot_details_ssid_el);
						
						const hotspot_details_password_el = document.createElement('input');
						hotspot_details_password_el.setAttribute('id','extension-power-settings-hotspot-password-input');
						hotspot_details_password_el.classList.add('network-settings-list-item-detail');
						hotspot_details_password_el.setAttribute('type','text');
						hotspot_details_password_el.setAttribute('placeholder','Password');
						hotspot_details_password_el.value = '' + body.hotspot_password;
						hotspot_details_password_el.addEventListener('change', () => {
							hotspot_details_password_el.value = hotspot_details_password_el.value.replaceAll(' ','-');
							if((hotspot_details_password_el.value.length == 0 || hotspot_details_password_el.value.length > 7) && hotspot_details_password_el.value != this.hotspot_password){
								this.hotspot_password = hotspot_details_password_el.value;
								//console.log("changing hotspot password to: ", this.hotspot_password);
								
					            window.API.postJson(
					                `/extensions/${this.id}/api/ajax`, {
					                    'action': 'set_hotspot_password', 'password':hotspot_details_password_el.value
					                }
					            ).then((body) => {
					                if(this.debug){
					                    console.log("power-settings debug: set_hotspot_password response: ", body);
					                }
					                if (body.state === true){
										hotspot_details_password_el.classList.add('extension-power-settings-hotspot-password-changed');
					                    setTimeout(() => {
					                    	hotspot_details_password_el.classList.remove('extension-power-settings-hotspot-password-changed');
					                    },1000);
					                }
        
					            }).catch((err) => {
					                console.log("caught error updating hotspot password via API: ", err);
					            });
								
							}
							else if(hotspot_details_password_el.value.length == 0){
								//console.warn("user changed hotspot password. It's not empty.");
								hotspot_details_password_el.setAttribute('placeholder','No password required');
							}
							else if(hotspot_details_password_el.value.length < 8){
								//console.warn("user changed hotspot password, but it's too short");
								hotspot_details_password_el.value = '';
								hotspot_details_password_el.setAttribute('placeholder','Too short');
							}
							else{
								//console.log("hotspot password is unchanged");
							}
							
						});
						hotspot_details_el.appendChild(hotspot_details_password_el);
						
						
						hotspot_settings_container_el.appendChild(hotspot_details_el);
						
						
						let hotspot_enabled_container_el = document.createElement('div');
						hotspot_enabled_container_el.classList.add('extension-power-settings-hotspot-enabled-checkbox-container');
						hotspot_enabled_container_el.classList.add('extension-power-settings-form-content');
						
						
						let hotspot_enabled_checkbox_el = document.createElement('input');
						hotspot_enabled_checkbox_el.setAttribute('type','checkbox');
						hotspot_enabled_checkbox_el.setAttribute('id','extension-power-settings-hotspot-enabled-checkbox');
						hotspot_enabled_checkbox_el.setAttribute('name','extension-power-settings-hotspot-enabled-checkbox');
						
						if(this.hotspot_enabled === true){
							hotspot_enabled_checkbox_el.setAttribute('checked',true);
						}
						
						hotspot_enabled_checkbox_el.addEventListener('change',() => {
							this.hotspot_enabled = hotspot_enabled_checkbox_el.checked;
							
				            window.API.postJson(
				                `/extensions/${this.id}/api/ajax`, {
				                    'action': 'set_hotspot_enabled', 'enabled':this.hotspot_enabled
				                }
				            ).then((body) => {
				                if(this.debug){
				                    console.log("set_hotspot_enabled response: ", body);
				                }
				                if (body.state === true){
									hotspot_enabled_checkbox_el.classList.add('extension-power-settings-hotspot-password-changed');
				                    setTimeout(() => {
				                    	hotspot_enabled_checkbox_el.classList.remove('extension-power-settings-hotspot-password-changed');
				                    },1000);
				                }
    
				            }).catch((err) => {
				                console.log("caught error updating hotspot password via API: ", err);
				            });
							
						});
						
						hotspot_enabled_container_el.appendChild(hotspot_enabled_checkbox_el);
						
						
						let hotspot_enabled_label_el = document.createElement('label');
						//hotspot_enabled_label_el.classList.add('extension-power-settings-hotspot-enabled-checkbox-container');
						hotspot_enabled_label_el.setAttribute('for','extension-power-settings-hotspot-enabled-checkbox');
						hotspot_enabled_container_el.appendChild(hotspot_enabled_label_el);
						
						
						hotspot_settings_container_el.appendChild(hotspot_enabled_container_el);
						
						/*
						const hotspot_addon_view_el = document.getElementById('extension-candleappstore-view');
						if(hotspot_addon_view_el){
							let hotspot_addon_button_el = document.createElement('button');
							hotspot_addon_button_el.classList.add('network-settings-list-item-button');
							hotspot_addon_button_el.classList.add('text-button');
							hotspot_addon_button_el.setAttribute('data-l10n-id','network-settings-configure');
							hotspot_addon_button_el.textContent = 'Configure';
							hotspot_addon_button_el.addEventListener('click',() => {
								window.location.href = window.location.origin + "/extensions/hotspot";
							});
							hotspot_settings_container_el.appendChild(hotspot_addon_button_el);
						}
						*/
						
						
						const hotspot_connected_devices_container_el = document.createElement('div');
						hotspot_connected_devices_container_el.classList.add('extension-power-settings-hotspot-connected-devices-container');
						//hotspot_connected_devices_container_el.setAttribute('id','extension-power-settings-hotspot-connected-devices-container');
						
						const update_connected_devices_list = () => {
							//console.log("in update_connected_devices_list. this.hotspot_connected_devices: ", this.hotspot_connected_devices);
							if(Array.isArray(this.hotspot_connected_devices)){
								
								hotspot_connected_devices_container_el.innerHTML = '';
								
								this.hotspot_connected_devices.sort();
							
								for(let cd = 0; cd < this.hotspot_connected_devices.length; cd++){
									const hotspot_connected_device_container_el = document.createElement('div');
									if(this.kiosk){
										const hotspot_connected_device_span_el = document.createElement('span');
										hotspot_connected_device_span_el.textContent = this.hotspot_connected_devices[cd];
										hotspot_connected_device_container_el.appendChild(hotspot_connected_device_span_el);
									}
									else{
										const hotspot_connected_device_link_el = document.createElement('a');
										hotspot_connected_device_link_el.setAttribute('href','http://' + this.hotspot_connected_devices[cd]);
										hotspot_connected_device_link_el.setAttribute('target','_blank');
										hotspot_connected_device_link_el.textContent = this.hotspot_connected_devices[cd];
										hotspot_connected_device_container_el.appendChild(hotspot_connected_device_link_el);
									}
									hotspot_connected_devices_container_el.appendChild(hotspot_connected_device_container_el);
								}
							}
							
							
							setTimeout(() => {
								if(document.location.href.endsWith('/settings/network')){
									//console.log("calling get_hotspot_connected_devices for an updated list");
						            window.API.postJson(
						                `/extensions/${this.id}/api/ajax`, {
						                    'action': 'get_hotspot_connected_devices'
						                }
						            ).then((body) => {
										if(typeof body.hotspot_connected_devices != 'undefined'){
											
											this.hotspot_connected_devices = body.hotspot_connected_devices;
											//console.log("calling get_hotspot_connected_devices returned: ", this.hotspot_connected_devices);
											update_connected_devices_list();
										}
						            }).catch((err) => {
						                console.error("power-settings get_hotspot_connected_devices error: ", err);
						            });
								}
							},10000);
							
						
						}
						
						update_connected_devices_list();
						
						//hotspot_settings_container_el.appendChild(hotspot_connected_devices_container_el);
						
						
						hotspot_settings_list_item_el.appendChild(hotspot_settings_container_el);
						hotspot_settings_list_item_el.appendChild(hotspot_connected_devices_container_el);
						
						
						network_settings_list_el.appendChild(hotspot_settings_list_item_el);
						
					}
					else{
						const hotspot_connected_checkbox_el = document.getElementById('extension-power-settings-hotspot-enabled-checkbox');
						if(hotspot_connected_checkbox_el && typeof body.hotspot_enabled == 'boolean'){
							hotspot_connected_checkbox_el.setAttribute('checked',body.hotspot_enabled);
						}
						
						const hotspot_password_input_el = document.getElementById('extension-power-settings-hotspot-password-input');
						if(hotspot_password_input_el && typeof body.hotspot_password == 'string'){
							hotspot_password_input_el.value = body.hotspot_password;
						}
					}
				}
				
            }
        }
        
        show_clock_page(){
            //console.log("in show_clock_page");
            window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'clock_page_init'
                }
            ).then((body) => {
                if(this.debug){
                    console.log("power settings debug: clock page init response: ", body);
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
                    console.log("power settings debug: cleared old recovery_interval for /poll");
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
                                    console.log("power settings debug: recovery update poll response: ", body);
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
                console.log("power settings debug: in start_poll");
            }
            // reset process output, just in case
            
            
            if( this.overlay_exists == false ){
                if(this.debug){
                    console.log("power settings debug: start_poll: overlay does not exist");
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
                    console.log("power settings debug: start_poll: overlay still exist");
                }
            }

            
			try{
				clearInterval(this.interval);
                this.interval = null;
                if(this.debug){
                    console.log("power settings debug: cleared old interval for /poll");
                }
			}
			catch(e){
				//console.log("no interval to clear?: " + e);
			}
            
            if(this.interval == null){
    			this.interval = setInterval(() => {
                    if(this.debug){
                        console.log("power settings debug: in interval for /poll");
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
			if(this.debug){
				console.log("power settings: in check if back");
			}
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
					if(this.debug){
                    	console.log("not back yet");
					}
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
                            console.log("power settings debug: running on early release candidate");
                        }
                        this.update_available_text = "available";
                    }
                    else if(body.candle_original_version == '2.0.0'){
                        this.update_available_text = "available";
                        if(this.debug){
                            console.log("power settings debug: running on RC4");
                        }
                    }
                    else if(body.candle_original_version == '2.0.0-beta'){
                        this.update_available_text = "available"
                        if(this.debug){
                            console.log("power settings debug: running on updated release candidate, nice");
                        }
                    }
                    else if(body.candle_original_version == '2.0.1'){
                        this.update_available_text = "available"
                        if(this.debug){
                            console.log("power settings debug: running on 2.0.1");
                        }
                    }
                    else if(body.candle_original_version == '2.0.2'){
                        this.update_available_text = ""
                        if(this.debug){
                            console.log("power settings debug: running on 2.0.2, brilliant");
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
                        }
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
				console.error("Error hiding all settings containers: ", e);
            }
			
			let background_color = window.getComputedStyle( document.body, null).getPropertyValue('background-color');
			document.getElementById('extension-power-settings-pages').style.backgroundColor = background_color;
			
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
								document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<p>Restoring and restarting...</p>';
								alert("The system will be unavailable for a few minutes while the backup is being restored");
								/*
                                if(confirm("The system will be unavailable for a few minutes while the backup is being restored")){
									window.API.postJson('/settings/system/actions', {
                                        action: 'restartSystem'
                                    }).catch(console.error);
                                    document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<p>Restoring and restarting...</p>';
                                }
                                else{
                                    document.getElementById("extension-power-settings-backup-file-selector-container").innerHTML = '<p>Please reboot the controller to complete the restore process.</p>';
                                }
								*/
								
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
                    console.log("power settings: expand_user_partition response: ", body);
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
		
		
		
		
		//
		//   AUDIO
		//  
		
		
        show_audio_page(){
			
			this.debug = true; // TODO: REMOVE THIS
			
            if(this.debug){
				console.log("power settings debug: in show_audio_page");
			}
            
			window.API.postJson(
                `/extensions/${this.id}/api/ajax`, {
                    'action': 'audio_init'
                }
            ).then((body) => {
                if(this.debug){
                    console.log("power settings: audio page init response: ", body);
                }
				
				// This should never happen if pipewire isn't enabled in the first place..
                if(typeof body.pipewire_enabled != 'undefined'){
					if(body.pipewire_enabled){
						if(this.debug){
							console.log("pipewire is enabled");
						}
					}
					this.pipewire_enabled = body.pipewire_enabled;
                    
                }
				
				if(typeof body.pipewire_data != 'undefined'){
					if(this.debug){
						console.log("power settings debug: got pipewire data: ", body.pipewire_data);
					}
					this.pipewire_data = body.pipewire_data;
					this.generate_audio_lists();
				}
				
				
				//extension-power-settings-audio-sink-list-container
				
                
            }).catch((e) => {
               console.error("Error: audio page init: connection failed: ", e);
            });
        }
		
		
		generate_audio_lists(){
            if(this.debug){
				console.log("in generate_audio_lists");
			}
			try{
				
				// not used?
				//const sink_list_el = document.getElementById('extension-power-settings-audio-sink-list-container');
				//const source_list_el = document.getElementById('extension-power-settings-audio-source-list-container');
				//const audio_device_els = [source_list_el, sink_list_el];
				
				
				/*
				if( Object.keys(this.connected_printers).length == 0 ){
					printer_list_el.innerHTML = '<p style="text-align:center">No printers detected</p>';
				}
				else{
					printer_list_el.innerHTML = '';
				}
				*/
				
				
				let found_an_audio_device = false;
				
				const audio_device_types = ['source','sink'];
				for (var a = 0; a < audio_device_types.length; a++){
					const dev_type = audio_device_types[a];
					
					if(this.pipewire_data['default_audio_' + dev_type + '_nice_name'] == 'undefined'){
						if(this.debug){
							console.error("power settings: audio: dev_type: default device undefined: ", this.pipewire_data);
						}
						continue
					}
					if(this.pipewire_data['default_audio_' + dev_type + '_nice_name'] == null){
						if(this.debug){
							console.error("power settings: audio: dev_type: default device not set: ", this.pipewire_data);
						}
						continue
					}
					
					if(this.debug){
						console.log("power settings debug: generating audio devices list for: ", dev_type);
					}
					
					const list_el = document.getElementById('extension-power-settings-audio-' + dev_type + '-list-container');
					if(list_el == null){
						console.error("could not find audio device list container");
						continue
					}
					
					if(typeof this.pipewire_data[dev_type + 's'] == 'undefined'){
						console.error("very strange, missing audio device type data in pipewire data.")
						continue
					}
					
					if(this.pipewire_data[dev_type + 's'] == null){
						list_el.innerHTML = 'No device found';
						continue
					}
					
					list_el.innerHTML = '';
					
					
					
					
					for (const [device, details] of Object.entries(this.pipewire_data[dev_type + 's'])) {
						if(this.debug){
							console.log("power settings debug: pipewire device and details: ", device, details);
						}
						
						let alsa_path = 'Not an ALSA device';
						if(typeof details.object_path != 'undefined'){
							alsa_path = details.object_path;
						}
						
						let node_name = 'None';
						if(typeof details.node_name != 'undefined'){
							node_name = details.node_name;
						}
						
						let audio_item_el = document.createElement('div');
						audio_item_el.classList.add('extension-power-settings-audio-item');
						audio_item_el.classList.add('extension-power-settings-vlak');
						audio_item_el.classList.add('extension-power-settings-audio-item-' + dev_type);
						audio_item_el.innerHTML = '<div class="extension-power-settings-audio-item-icon"></div><h2>' + details.nice_name + ' </h2><p>' + details.node_description + '</p><p class="extension-power-settings-show-if-developer">Pipewire ID: ' + details.id + '<br/>' + alsa_path + '</p><p class="extension-power-settings-show-if-developer">' + node_name  + '</p>';
						
						let radio_el = document.createElement('input');
						radio_el.type = 'radio';
						radio_el.id = 'extension-power-settings-audio-' + dev_type + '-' + details.id + '-radio-input';
						radio_el.name = 'extension-power-settings-audio-' + dev_type + '-radio-button';
						radio_el.classList.add('extension-power-settings-audio-item-radio-button');
						radio_el.setAttribute('data-pipewire-id',details.id);
						
						if(this.pipewire_data['default_audio_' + dev_type + '_nice_name'] == details.nice_name){
							radio_el.checked = true;
							audio_item_el.classList.add('extension-power-settings-audio-item-selected');
						}
						
						const pipewire_id = details.id;
						const my_dev_type = dev_type;
						
						radio_el.addEventListener('change', () => {
							if(this.debug){
								console.log("audio radio input changed to: ", pipewire_id);
							}
							let action_dict = {'action':'set_audio'};
							//action_dict['default_' + my_dev_type] = pipewire_id;
							action_dict['default_id'] = pipewire_id;
							if(this.debug){
								console.log("power settings: set_audio: action_dict: ", action_dict);
					        }
							window.API.postJson(
					          `/extensions/${this.id}/api/ajax`,action_dict

					        ).then((body) => {
								if(this.debug){
				                    console.log('Power settings: set_audio default device response: ', body);
				                }
								if(typeof body.pipewire_data != 'undefined'){
									this.pipewire_data = body.pipewire_data;
									this.generate_audio_lists();
								}

					        }).catch((e) => {
					  			console.error('Power settings: error during set_audio api call: ', e);
								alert("Could not connect with controller, your audio device preference may not have been saved");
					        });	
						
						});
						
						
						audio_item_el.appendChild(radio_el);
						
						
						// Volume slider
						
						// <input type="range" min="1" max="100" value="50" class="slider" id="myRange">
						if(typeof details.volume != 'undefined' && details.volume != null && details.volume != NaN){
							let volume_container_el = document.createElement('div');
							volume_container_el.classList.add('extension-power-settings-audio-item-volume-slider-container');
							
							let volume_slider_el = document.createElement('input');
							volume_slider_el.classList.add('extension-power-settings-audio-item-volume-slider');
							volume_slider_el.setAttribute('type','range');
							volume_slider_el.setAttribute('min','0');
							volume_slider_el.setAttribute('max','100');
							volume_slider_el.setAttribute('step','1');
							volume_slider_el.setAttribute('value',details.volume);
							volume_slider_el.addEventListener('change', () => {
								if(this.debug){
									console.log("audio volume slider changed to: ", volume_slider_el.value);
								}
								let action_dict = {'action':'set_audio'};
								action_dict['pipewire_id'] = pipewire_id;
								if(this.debug){
									console.log("power settings: set_audio volume: action_dict: ", action_dict);
								}
								window.API.postJson(
						          `/extensions/${this.id}/api/ajax`,action_dict

						        ).then((body) => {
									if(this.debug){
					                    console.log('Power settings: set_audio volume response: ', body);
					                }
									if(typeof body.pipewire_data != 'undefined'){
										this.pipewire_data = body.pipewire_data;
										//this.generate_audio_lists();
									}

						        }).catch((e) => {
						  			console.error('Power settings: error during set_audio api call: ', e);
									alert("Could not connect with controller, your audio device preference may not have been saved");
						        });	
							});
							
							volume_container_el.appendChild(volume_slider_el);
							audio_item_el.appendChild(volume_container_el);
						
						
						}
						
						list_el.appendChild(audio_item_el);
				
						if(dev_type == 'sink'){
							document.getElementById('extension-power-settings-test-speakers-button').style.display = 'inline-block';
						}
						found_an_audio_device = true;
				
					}
					
					
				}
				
				
				if(found_an_audio_device == false){
					document.getElementById('extension-power-settings-audio-no-devices').classList.remove('extension-power-settings-hidden');
					document.getElementById('extension-power-settings-test-speakers-button').style.display = 'none';
				}
				else{
					document.getElementById('extension-power-settings-audio-no-devices').classList.add('extension-power-settings-hidden');
				}
				
				
				
			}
			catch(e){
				console.error("power settings: error generating audio devices list: ", e);
			}
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
				
				let got_display_details = false;
				
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
							got_display_details = true;
							
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
									//console.log("spotted resolutions. info_value", typeof(info_value), info_value);
									
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
													console.warn("power settings debug: skipping non-60Hz display refresh rate: ", info_value[r][2]);
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
										console.error("power settings: error parsing edid resolutions: ", e);
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
							console.error("power settings: unable to parse display EDID data: ", e);
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
								console.log("power settings debug: disp_details : ", disp_details);
							}
							got_display_details = true;
							try{
								if(typeof disp_details['week'] != 'undefined' && typeof disp_details['year'] != 'undefined'){
									document.getElementById('extension-power-settings-display2-production-date').innerText = get_production_time(disp_details['week'], disp_details['year']);
								}
								
								if(typeof disp_details['manufacturer'] != 'undefined' && typeof disp_details['name'] != 'undefined'){
									//console.log("display manufacturer and name are available");
									
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
								console.log("power settings: caught error calculating display production date / generating display name: ", e);
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
									catch(err){
										console.error("power settings: caught error parsing edid resolutions: ", err);
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
							console.error("power settings: caught error attempting to parse display EDID data: ", e);
						}
					}
					else{
						document.getElementById('extension-power-settings-display2-details').innerHTML = '<p>No details available</p>';
					}
				}
				
				// fallback in case there was an issue with getting display details
				if(typeof body.has_a_display == 'boolean'){
					if(body.has_a_display == true){
						document.getElementById('extension-power-settings-no-display').classList.add('extension-power-settings-hidden');
						if(got_display_details == false && document.getElementById('extension-power-settings-display1-details').innerHTML == ''){
							document.getElementById('extension-power-settings-display1-details').innerHTML = '<p>A display is connected, but no details are available</p>';
						}
					}
				}
				
				if(typeof body.mouse_pointer_enabled == 'boolean'){
					this.mouse_pointer_enabled = body.mouse_pointer_enabled;
					const mouse_pointer_checkbox_el = document.getElementById('extension-power-settings-show-mouse-pointer');
					if(mouse_pointer_checkbox_el){
						mouse_pointer_checkbox_el.setAttribute('checked', this.mouse_pointer_enabled);
						document.getElementById('extension-power-settings-mouse-pointer').classList.remove('extension-power-settings-hidden');
					}
				}
				
				
				
				
				
            }).catch((e) => {
                console.error("power settings: caught error sending get_display_info command: ", e);
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
	                    console.log("power settings debug: printer init response: ", body);
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
	                console.error("power settings: caught error in show printer page: ", e);
	            });
			}
		}
		
		
		
		generate_connected_printers_list(){
			if(this.debug){
				console.log("power settings debug: in generate_connected_printers_list. this.connected_printers: ", this.connected_printers);
			}
			try{
				
				const printer_list_el = document.getElementById('extension-power-settings-printers-list-container');
				
				if( Object.keys(this.connected_printers).length == 0 ){
					printer_list_el.innerHTML = '<p style="text-align:center">No printers detected</p>';
				}
				else{
					printer_list_el.innerHTML = '';
				}
				
				
				for (const [key, printer] of Object.entries(this.connected_printers)) {
				
					const printer_name = printer.id;
					if(this.debug){
						console.log("power settings debug: adding printer to list: ", printer_name);
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

				if(document.body.classList.contains('developer')){
					this.developer = true;
				}
				else{
					this.developer = false;
				}

                // Show the total memory
                if(typeof body['total_memory'] != 'undefined'){
                    document.getElementById('extension-power-settings-total-memory').innerText = body['total_memory'];
                
					// temperature
	                if(typeof body['board_temperature'] == 'string' ){
	                    if(this.debug){
	                        console.log("power settings: board_temperature: ", body.board_temperature);
	                    }
	                    document.getElementById('extension-power-settings-device-temperature').innerText = body.board_temperature;
						
						if(body.board_temperature.endsWith("'C")){
							const temp = parseInt(body.board_temperature.replace("'C",""));
							console.log("board temperature: ",temp);
							if(temp < 60){
								document.getElementById('extension-power-settings-device-temperature').style.color = 'green';
							}
							else if(temp < 80){
								document.getElementById('extension-power-settings-device-temperature').style.color = 'orange';
							}
							else{
								document.getElementById('extension-power-settings-device-temperature').style.color = 'red';
							}
						}
						
						
	                }
				
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
				
				
				if(typeof body['ethernet_connected'] != 'undefined'){
					if(body['ethernet_connected']){
						document.getElementById('extension-power-settings-attached-network-cable-container').classList.add('extension-power-settings-network-cable-plugged');
						document.getElementById('extension-power-settings-attached-network-cable-container').classList.remove('extension-power-settings-network-cable-unplugged');
					}
					else{
						document.getElementById('extension-power-settings-attached-network-cable-container').classList.add('extension-power-settings-network-cable-unplugged');
						document.getElementById('extension-power-settings-attached-network-cable-container').classList.remove('extension-power-settings-network-cable-plugged');
					}
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
									if(this.developer == false){
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
								attached_list_el.innerHTML = '<div class="extension-power-settings-attached-item"><p>None</p></div>';
							}
						}
						
					}
					else{
						console.warn("power settings: usb devices list element not found");
					}
				}
				
				
				// Show attached devices
				if(typeof body['attached_cameras'] != 'undefined'){
					
					this.attached_cameras = body['attached_cameras'];
					if(this.debug){
						console.log("this.attached_cameras: ", this.attached_cameras);
					}
					let cameras_list_el = document.getElementById('extension-power-settings-attached-cameras-list-container');
					
					if(cameras_list_el){
	                    
						if(typeof this.attached_cameras == 'object' && Array.isArray(this.attached_cameras) && this.attached_cameras.length){
							cameras_list_el.innerHTML = '<div class="extension-power-settings-attached-item"><p>A camera was detected</p></div>';
						}
						else{
							cameras_list_el.innerHTML = '<div class="extension-power-settings-attached-item"><p>None</p></div>';
						}
						
					}
					else{
						console.warn("power settings: cameras list element not found");
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
						if(this.debug){
							console.log("power settings: user partition seems to be fully expanded");
						}
                        if(document.getElementById('extension-power-settings-user-partition-expansion-hint') != null){
							document.getElementById('extension-power-settings-user-partition-expansion-hint').style.display = 'none';
                        }
					}
                }
				
                // Show user_partition_expansion_failed
                if(typeof body['user_partition_expansion_failed'] != 'undefined'){
					let partition_expansion_failed_el = document.getElementById('extension-power-settings-partition-expansion-failed');
					if(partition_expansion_failed_el){
						if(body['user_partition_expansion_failed'] == true){
							partition_expansion_failed_el.style.display = 'block';
							document.getElementById('extension-power-settings-user-partition-expansion-hint').style.display = 'block';
							document.getElementById('extension-power-settings-user-partition-expansion-button').style.display = 'block';
							document.getElementById('extension-power-settings-busy-expanding-user-partition').style.display = 'none';
						}
						else{
							partition_expansion_failed_el.style.display = 'none';
						}
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
