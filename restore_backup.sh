#! /bin/bash

# This script tries to restore a backup
# It doesn't care about the RO system, since if only acts on the user data partition



# Restore the data directories
echo "$(date) - restoring Candle backup" >> /home/pi/.webthings/candle.log

sudo systemctl stop webthings-gateway.service


BIT_TYPE=$(getconf LONG_BIT)
echo "Bits: $BIT_TYPE"

ARCHSTRING=linux-arm
if [ $BIT_TYPE -eq 64 ]; then
    ARCHSTRING=linux-arm64
fi

COUNTER=0

if [ ! -f /home/pi/.webthings/data/power-settings/candle_restore.tar ]; then
    echo "Error, backup file to restore from is missing. Aborting."
else
    
    
    echo "unpacking the backup file"
    # unpack the backup file
    tar -xf /home/pi/.webthings/data/power-settings/candle_restore.tar -C /home/pi/.webthings/


	# Wait for IP address for at most 30 seconds
	echo "Candle: late: waiting for IP address"
	for i in {1..3}
	do
	    #echo "current hostname: $(hostname -I)"
		IPS=$(hostname -I | sed -r 's/192.168.12.1//' | xargs)
	    if [ "$IPS" = "" ]
	    then
			echo "Candle: late.sh: no network yet $i"
		    echo "no network yet $i"
			sleep 1    
	    else
			echo "Candle: late.sh: IP address detected: $(hostname -I)"
			break
	    fi
	done

	if [ -f /home/pi/.webthings/log/logs.sqlite3 ]; then
		mv /home/pi/.webthings/log/logs.sqlite3 /home/pi/.webthings/log/logs.sqlite3_bak
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
                echo "OK Addon is already installed: $directory"
            else
                echo "will attempt to download missing addon: $directory"
                echo "Candle: will download missing addon: $directory"
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
                        chmod -R 0755 "/home/pi/.webthings/addons/$directory"
                        echo "Candle: restoring backup: succesfully downloaded addon: $directory"
                    fi
                    rm missing.tar
                else
                    echo "Candle: restoring backup: download of missing addon failed: $directory"
                fi
            

            fi

        done < <(ls /home/pi/.webthings/data)
    
    else
        echo "Candle: Backup restored, but downloading latest addons list failed. Did not restore addons."
    fi
    
fi


# if the backup didn't restore an entire log file, then put the initial version back, and see if there is logs_meta data to use instead
if [ ! -f /home/pi/.webthings/log/logs.sqlite3 ]; then
	if [ -f /home/pi/.webthings/log/logs.sqlite3_bak ]; then
		mv /home/pi/.webthings/log/logs.sqlite3_bak /home/pi/.webthings/log/logs.sqlite3
		
		if [ -f /home/pi/.webthings/data/power-settings/logs_meta.sqlite3 ]; then
	
			#log_meta = run_command("sqlite3 " + str(self.log_db_file_path) + " 'SELECT id, descr, maxAge FROM metricIds'")
			echo "restoring logs from meta data"
	
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
				
						
				
						(printf "INSERT INTO metricIds VALUES ('%s', '%s', '%s');" $ID $DESCR $MAXAGE) | sqlite3 /home/pi/.webthings/log/logs.sqlite3
				
					else
						echo "A VALUE WAS EMPTY, NOT WRITING TO LOGS DB!"
					fi
			
				else
			  	    	echo "Log meta line did not seem valid!"
				fi
	  
			done
	
		fi
	else
		echo "Candle: ERROR, /home/pi/.webthings/log/logs.sqlite3 file seems to be missing!"
	fi
	
else
	if [ -f /home/pi/.webthings/log/logs.sqlite3_bak ]; then
		rm /home/pi/.webthings/log/logs.sqlite3_bak
	fi
	
	if [ -f /home/pi/.webthings/data/power-settings/logs_meta.sqlite3 ]; then
		rm /home/pi/.webthings/data/power-settings/logs_meta.sqlite3
	fi
fi


# clean up the candle_backuped.txt files, which were necessary to make sure that all /data folders were added to the backup file, even if they were empty before
find /home/pi/.webthings/data -maxdepth 1 -type d -exec sh -c 'rm $1/candle_backuped.txt' _ {} \;



# Clean up
sudo systemctl start webthings-gateway.service
exit 1