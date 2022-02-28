#! /bin/bash

# This script tries to do a factory reset
sudo systemctl stop webthings-gateway.service
sleep 5

#sudo apt-get update


# Clear caches
#npm cache clean --force
#nvm cache clear

sudo apt-get clean
sudo apt autoremove
rm -rf ~/.cache/pip

# delete old files from temporary files folder
sudo find /tmp -type f -atime +10 -delete

# clear persistent data from Candle addons
find ~/.webthings/data -type f -name 'persistence.json'  -delete


# Resize disk on next boot
#isInFile=$(cat /boot/cmdline.txt | grep -c "init=/usr/lib/raspi-config/init_resize.sh")
#if [ $isInFile -eq 0 ]
#then
#    echo -n " init=/usr/lib/raspi-config/init_resize.sh" | sudo tee -a /boot/cmdline.txt
#    echo "- Added resize command to /boot/cmdline.txt"
#else
#    echo "- Warning: the cmdline.txt file was already modified?"
#fi

# Clear the wifi password
echo -e 'ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev\nupdate_config=1\ncountry=NL\n' | sudo tee /etc/wpa_supplicant/wpa_supplicant.conf

rm ~/.webthings/config/db.sqlite3
cp ~/.webthings/addons/power-settings/db.sqlite3 ~/.webthings/config/db.sqlite3

# remove logs
rm -rf ~/.webthings/log/{*,.*}

# remove uploaded images
rm -f ~/.webthings/data/photo-frame/photos/*
rm -f ~/.webthings/data/photo-frame/photos/*
rm -f ~/.webthings/uploads/*
cp ~/.webthings/floorplan.svg ~/.webthings/uploads/floorplan.svg

# remove any addons that are not the originals
cd ~/.webthings/addons && find -not -path "./candleappstore*" -not -path "./candle-theme*" -not -path "./power-settings*" -not -path "./webinterface*" -not -path "./zigbee2mqtt-adapter*" -not -path "./hotspot*" -not -path "./followers*" -not -path "./privacy-manager*" -not -path "./photo-frame*" -not -path "./welcome*" -not -path "./network-presence-detection-adapter*" -not -path "./internet-radio*"  -not -path "./bluetoothpairing*" -not -path "./scenes*" -delete
cd ~/.webthings/data && find -not -path "./candleappstore*" -not -path "./candle-theme*" -not -path "./power-settings*" -not -path "./webinterface*" -not -path "./zigbee2mqtt-adapter*" -not -path "./hotspot*" -not -path "./followers*" -not -path "./privacy-manager*" -not -path "./photo-frame*" -not -path "./welcome*" -not -path "./network-presence-detection-adapter*" -not -path "./internet-radio*"  -not -path "./bluetoothpairing*" -not -path "./scenes*" -delete
#cd ~/.webthings/addons && find -maxdepth 1 -type d -not -path "./candleappstore*" -not -path "./candle-theme*" -not -path "./power-settings*" -not -path "./webinterface*" -not -path "./zigbee2mqtt-adapter*" -not -path "./hotspot*" -not -path "./followers*" -not -path "./privacy-manager*" -not -path "./photo-frame" -not -path "./welcome*" -not -path "./network-presence-detection-adapter*" -not -path "./internet-radio*"  -delete
#cd ~/.webthings/data && find -maxdepth 1 -type d -not -path "./candleappstore*" -not -path "./candle-theme*" -not -path "./power-settings*" -not -path "./webinterface*" -not -path "./zigbee2mqtt-adapter*" -not -path "./hotspot*" -not -path "./followers*" -not -path "./privacy-manager*" -not -path "./photo-frame" -not -path "./welcome*" -not -path "./network-presence-detection-adapter*" -not -path "./internet-radio*"  -delete

# clear Bash history
echo "Well hello there" > ~/.bash_history
#cat /dev/null > ~/.bash_history

# clear syslog
sudo truncate -s 0 /var/log/syslog
sudo rm /var/log/syslog.1
sudo systemd-tmpfiles --clean
sudo systemd-tmpfiles --remove

#RESETZ2M=$1

#if [ "$RESETZ2M" == "true" ]; then

if [ -f "/boot/keep_z2m.txt" ]; then
    echo "Factory reset is allowing Zigbee2MQTT to remain"
else
    echo F"actory reset: also resetting Zigbee2MQTT"
    rm ~/.webthings/data/zigbee2mqtt-adapter/*.db
    rm ~/.webthings/data/zigbee2mqtt-adapter/*.yaml
    rm ~/.webthings/data/zigbee2mqtt-adapter/*.json
    rm ~/.webthings/data/zigbee2mqtt-adapter/database.db.backup
fi


echo "DONE. Shutting down.."

sudo raspi-config nonint do_ssh 0

sudo shutdown now
