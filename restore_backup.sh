#! /bin/bash

# This script tries to restore a backup


# Restore the data directories
tar -xf /home/pi/.webthings/data/power-settings/candle_restore.tar -C /home/pi/.webthings/


# Wait for IP address for at most 30 seconds
 echo "waiting for IP address"
 for i in {1..30}
 do
   #echo "current hostname: $(hostname -I)"
   if [ "$(hostname -I)" = "" ]
   then
     echo "Candle: rc.local doing bootup_actions: no network yet $i" >> /dev/kmsg
     echo "no network yet $i"
     sleep 1    
   else
     echo "Candle: rc.local doing bootup_actions: IP address detected: $(hostname -I)" >> /dev/kmsg
     break
   fi
 done


cd /tmp

# Download latest list of available addons
wget https://www.candlesmarthome.com/appstore/get_apps.json -O /tmp/addons.json

# Loop over data dir and compare with addons dir
if [ -f /tmp/addons.json ]; then
    while IFS= read -r directory
    do
        if [ -d "/home/pi/.webthings/addons/$directory" ]; then
            echo "OK"
        else
            echo "Candle: will download missing addon: $directory" >> /dev/kmsg
            
            if [ -f missing.tar ]; then
                echo "somehow missing.tar still existed"
                rm missing.tar
            fi
            
            # Extract download URL
            cat /tmp/addons.json | \
            grep download_url | \
            grep "/$directory"  | \
            sed -n 's/"download_url": *"\([^"]*\).*/\1/p' | \
            sed 's/\\//g' | \
            xargs wget -O missing.tar

            if [ -f missing.tar ]; then
                echo "extracting tar..."
                tar -xf missing.tar
                if [ -d package ]; then
                    echo "moving extracted package into place"
                    mv ./package "/home/pi/.webthings/addons/$directory"
                    chown -R pi:pi "/home/pi/.webthings/addons/$directory"
                    echo "Candle: succesfully downloaded missing addon: $directory" >> /dev/kmsg
                fi
                rm missing.tar
            else
                echo "Candle: Download of missing addon failed: $directory" >> /dev/kmsg
            fi

        fi

    done < <(ls /home/pi/.webthings/data)
else
    echo "Candle: Backup restored, but downloading latest addons list failed. Did not restore addons." >> /dev/kmsg
    echo "$(date) - Backup restored, but downloading latest addons list failed. Did not restore addons."
fi



rm /boot/bootup_actions.sh
#sudo systemctl start webthings-gateway.service
