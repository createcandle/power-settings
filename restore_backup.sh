#! /bin/bash

# This script tries to restore a backup
# It doesn't care about the RO system, since if only acts on the user data partition

# Restore the data directories
echo "" >> /boot/candle_log.txt
echo "$(date) - restoring Candle backup" >> /boot/candle_log.txt
echo "$(date) - restoring Candle backup" >> /home/pi/.webthings/candle.log
echo "$(date) - restoring Candle backup" >> /dev/kmsg



# all this may get overwritten by a complete log file later
if [ -f /home/pi/.webthings/data/power-settings/logs_meta.sqlite3 ] && [ -f /home/pi/.webthings/log/logs.sqlite3 ]; then
	
	#log_meta = run_command("sqlite3 " + str(self.log_db_file_path) + " 'SELECT id, descr, maxAge FROM metricIds'")
	echo "restoring logs"
	
	sqlite3 /home/pi/.webthings/log/logs.sqlite3 'DELETE FROM metricIds;'
	sqlite3 /home/pi/.webthings/log/logs.sqlite3 'DELETE FROM metricsBoolean;'
	sqlite3 /home/pi/.webthings/log/logs.sqlite3 'DELETE FROM metricsNumber;'
	sqlite3 /home/pi/.webthings/log/logs.sqlite3 'DELETE FROM metricsOther;'
	
	LINES=$(cat /home/pi/.webthings/data/power-settings/logs_meta.sqlite3)
	echo
	echo "LINES: "
	echo $LINES
	echo

	IFS='
	'
	COUNT=0
	for LINE in $LINES
	do
		COUNT=$((COUNT+1))
		echo "$COUNT  -> $LINE"
	  
		if [[ "$LINE" == *\|* ]]; then
  	    	echo "Line seems valid"
			
			ID=$(echo $LINE | cut -d '|' -f 1)
			DESCR=$(echo $LINE | cut -d '|' -f 2)
			MAXAGE=$(echo $LINE | cut -d '|' -f 3)
			echo "ID: $ID"
			echo "DESCR: $DESCR"
			echo "MAXAGE: $MAXAGE"
			
			if [ -n "$ID" ] && [ -n "$DESCR" ] && [ -n "MAXAGE" ]; then
				#sqlite3 /home/pi/.webthings/log/logs.sqlite3 'INSERT INTO metricIds (id, descr, maxAge) VALUES ($ID, $DESCR, $MAXAGE);'
				
				echo "Candle: restore_backup.sh: adding log: $DESCR" >> /dev/kmsg
				
				(printf "INSERT INTO metricIds VALUES ('%s', '%s', '%s');" $ID $DESCR $MAXAGE) | sqlite3 /home/pi/.webthings/log/logs.sqlite3
				
			else
				echo "A VALUE WAS EMPTY, NOT WRITING TO LOGS DB!"
			fi
			
		else
	  	    	echo "Log meta line did not seem valid!"
		fi
	  
	done
	
fi






BIT_TYPE=$(getconf LONG_BIT)
echo "Bits: $BIT_TYPE"

ARCHSTRING=linux-arm
if [ $BIT_TYPE -eq 64 ]; then
    ARCHSTRING=linux-arm64
fi

COUNTER=0

if [ ! -f /home/pi/.webthings/data/power-settings/candle_restore.tar ]; then
    echo "Error, backup file to restore from is missing. Aborting."
    echo "Error, backup file to restore from is missing. Aborting." >> /boot/candle_log.txt
    
    echo "Candle: Backup restored, but downloading latest addons list failed. Did not restore addons." >> /dev/kmsg
    echo "$(date) - Backup restored, but downloading latest addons list failed. Did not restore addons." >> /boot/candle_log.txt

    if [ -e "/bin/ply-image" ] && [ -e /dev/fb0 ] && [ -f "/boot/error.png" ]; then
        /bin/ply-image /boot/error.png
    fi
    sleep 7
    
else
    
    if [ -e "/bin/ply-image" ] && [ -e /dev/fb0 ] && [ -f "/boot/splash_updating-0.png" ] && [ -f "/boot/splash_updating180-0.png" ]; then
        if [ -e "/boot/rotate180.txt" ]; then
            /bin/ply-image /boot/splash_updating180-0.png
        else
            /bin/ply-image /boot/splash_updating-0.png
        fi
    fi
    sleep 1





    echo "unpacking the backup file"
    # unpack the backup file
    tar -xf /home/pi/.webthings/data/power-settings/candle_restore.tar -C /home/pi/.webthings/


    if [ -e "/bin/ply-image" ] && [ -e /dev/fb0 ] && [ -f "/boot/splash_updating-1.png" ] && [ -f "/boot/splash_updating180-1.png" ]; then
        if [ -e "/boot/rotate180.txt" ]; then
            /bin/ply-image /boot/splash_updating180-1.png
        else
            /bin/ply-image /boot/splash_updating-1.png
        fi
    fi
    sleep 1

	# Wait for IP address for at most 30 seconds
	echo "Candle: late: waiting for IP address"
	for i in {1..30}
	do
	    #echo "current hostname: $(hostname -I)"
		IPS=$(hostname -I | sed -En "s/(.*) 192.168.12.1/\1/p" | xargs)
	    if [ "$IPS" = "" ]
	    then
			echo "Candle: late.sh: no network yet $i" >> /dev/kmsg
		    echo "no network yet $i"
			sleep 1    
	    else
			echo "Candle: late.sh: IP address detected: $(hostname -I)" >> /dev/kmsg
			break
	    fi
	done



     #download additional splash images if they don't exist already
     if [ ! -f "/boot/splash_updating-0.png" ] && [ -d /boot ]; then
         echo "Downloading progress bar images"
         wget https://www.candlesmarthome.com/tools/splash_updating-0.png -O /boot/splash_updating-0.png
         wget https://www.candlesmarthome.com/tools/splash_updating-1.png -O /boot/splash_updating-1.png
         wget https://www.candlesmarthome.com/tools/splash_updating-2.png -O /boot/splash_updating-2.png
         wget https://www.candlesmarthome.com/tools/splash_updating-3.png -O /boot/splash_updating-3.png
         wget https://www.candlesmarthome.com/tools/splash_updating-4.png -O /boot/splash_updating-4.png
         wget https://www.candlesmarthome.com/tools/splash_updating180-0.png -O /boot/splash_updating180-0.png
         wget https://www.candlesmarthome.com/tools/splash_updating180-1.png -O /boot/splash_updating180-1.png
         wget https://www.candlesmarthome.com/tools/splash_updating180-2.png -O /boot/splash_updating180-2.png
         wget https://www.candlesmarthome.com/tools/splash_updating180-3.png -O /boot/splash_updating180-3.png
         wget https://www.candlesmarthome.com/tools/splash_updating180-4.png -O /boot/splash_updating180-4.png
         wget -c https://www.candlesmarthome.com/tools/error.png -O /boot/error.png
         echo "Downloading progress bar images done"
     fi

    cd /tmp


    # Download latest list of available addons
    echo "Downloading get_apps.json"
    wget https://www.candlesmarthome.com/appstore/get_apps.json -O /tmp/addons.json

    # Loop over data dir and compare with addons dir
    if [ -f /tmp/addons.json ]; then
        
        while IFS= read -r directory
        do
            #echo "checking $directory"
            if [ -d "/home/pi/.webthings/addons/$directory" ]; then
                echo "already installed: $directory"
                echo "OK Addon is already installed: $directory" >> /dev/kmsg
            else
                echo "will attempt to download missing addon: $directory"
                echo "Candle: will download missing addon: $directory" >> /dev/kmsg
                let COUNTER=COUNTER+1
                if [ -f missing.tar ]; then
                    echo "somehow missing.tar still existed. removing it."
                    rm missing.tar
                fi
            
                # get all potential download URL's
                URLS=$(cat /tmp/addons.json | \
                    grep '"url"' | \
                    grep "/$directory"  | \
                    sed -n 's/"url": *"\([^"]*\).*/\1/p' | \
                    sed 's/\\//g' )
                
                
                echo "DOWNLOAD CANDIDATES:"
                echo " $URLS"
            
                if [[ $URLS == *"linux-arm64"* ]]; then
                    echo "linux-arm64 spotted"
                    if [ $BIT_TYPE -eq 64 ]; then
                        URLS=$(echo "$URLS" | grep "linux-arm64")
                
                    else
                        URLS=$(echo "$URLS" | grep -v "linux-arm64")
                    fi
                fi
            
               	if [[ $URLS == *"v3.11."* ]]; then
                    echo "v3.11. spotted"
                    URLS=$(echo "$URLS" | grep "v3.11.")
	            elif [[ $URLS == *"v3.9."* ]]; then
	            	echo "v3.9. spotted"
	            	URLS=$(echo "$URLS" | grep "v3.9.")
                fi
            
                if [ -n "$URLS" ]; then
                    echo "selecting first URL from remaining list:"
                    URLS=`echo "${URLS}" | head -1`
                    echo "$URLS"
            
                    wget $URLS -O missing.tar
            
                else
                    echo "Did not find a download URL - does addon exist?"
                fi

                if [ -f missing.tar ]; then
                    echo "extracting tar..."
                    tar -xf missing.tar
                    if [ -d package ]; then
                        echo "moving extracted package into place"
                        mv ./package "/home/pi/.webthings/addons/$directory"
                        chown -R pi:pi "/home/pi/.webthings/addons/$directory"
                        echo "Candle: succesfully downloaded missing addon: $directory" >> /dev/kmsg
                        echo "Candle: restoring backup: succesfully downloaded addon: $directory" >> /boot/candle_log.txt
                    fi
                    rm missing.tar
                else
                    echo "Candle: restoring backup: download of missing addon failed: $directory" >> /dev/kmsg
                    echo "Candle: restoring backup: download of missing addon failed: $directory" >> /boot/candle_log.txt
                fi
            
                if [ "$COUNTER" == 3 ]; then
                    if [ -e "/bin/ply-image" ] && [ -e /dev/fb0 ] && [ -f "/boot/splash_updating-2.png" ] && [ -f "/boot/splash_updating180-2.png" ]; then
                        if [ -e "/boot/rotate180.txt" ]; then
                            /bin/ply-image /boot/splash_updating180-2.png
                        else
                            /bin/ply-image /boot/splash_updating-2.png
                        fi
                    fi
                    sleep 1
                fi
            
                if [ "$COUNTER" == 7 ]; then
                    if [ -e "/bin/ply-image" ] && [ -e /dev/fb0 ] && [ -f "/boot/splash_updating-3.png" ] && [ -f "/boot/splash_updating180-3.png" ]; then
                        if [ -e "/boot/rotate180.txt" ]; then
                            /bin/ply-image /boot/splash_updating180-3.png
                        else
                            /bin/ply-image /boot/splash_updating-3.png
                        fi
                    fi
                    sleep 1
                fi

            fi

        done < <(ls /home/pi/.webthings/data)
    
    
        if [ -e "/bin/ply-image" ] && [ -e /dev/fb0 ] && [ -f "/boot/splash_updating-4.png" ] && [ -f "/boot/splash_updating180-4.png" ]; then
            if [ -e "/boot/rotate180.txt" ]; then
                /bin/ply-image /boot/splash_updating180-4.png
            else
                /bin/ply-image /boot/splash_updating-4.png
            fi
        fi
        sleep 1
    
    
    else
        echo "Candle: Backup restored, but downloading latest addons list failed. Did not restore addons." >> /dev/kmsg
        echo "$(date) - Backup restored, but downloading latest addons list failed. Did not restore addons." >> /boot/candle_log.txt
    
        if [ -e "/bin/ply-image" ] && [ -e /dev/fb0 ] && [ -f "/boot/error.png" ]; then
            /bin/ply-image /boot/error.png
        fi
        sleep 7
        
    fi
    
fi




# Clean up
rm /boot/bootup_actions.sh
rm /boot/bootup_actions_failed.sh
#sudo systemctl start webthings-gateway.service
exit 1