#! /bin/bash

# This script tries to do a factory reset.
# Some of the commands can only work when the disk overlay is disabled, but are run anyway to keep this a universal solution.

#raspi-config nonint disable_bootro

pkill chromium-browse
systemctl stop webthings-gateway.service
sleep 5

#sudo apt-get update


# Clear caches
#npm cache clean --force
#nvm cache clear
apt-get clean
apt autoremove
history -c
#rm -rf /home/pi/.cache/pip
#rm -rf /home/pi/.cache/chromium
rm -rf /home/pi/.cache
rm -rf /home/pi/.config/*
rm -rf /home/pi/.webthings/chromium/*
rm /home/pi/.webthings/chromium/'Local State'

rm -rf /home/pi/.local/share/nano/search_history
rm /root/.cache/.bluetoothctl_history
rm /home/pi/.cache/.bluetoothctl_history



# delete old files from temporary files folder
find /tmp -type f -atime +10 -delete

# clear persistent data from Candle addons
find /home/pi/.webthings/data -type f -name 'persistence.json'  -delete


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

echo "candle" > /etc/hostname

# restore basic database
rm /home/pi/.webthings/config/db.sqlite3
cp /home/pi/.webthings/addons/power-settings/db.sqlite3 /home/pi/.webthings/config/db.sqlite3
chown pi:pi /home/pi/.webthings/config/db.sqlite3

# remove logs
rm -rf /home/pi/.webthings/log/{*,.*}

# remove uploaded images
rm -f /home/pi/.webthings/data/photo-frame/photos/*
rm -f /home/pi/.webthings/uploads/*
cp /home/pi/.webthings/floorplan.svg /home/pi/.webthings/uploads/floorplan.svg
chown pi:pi /home/pi/.webthings/uploads/floorplan.svg

# remove any addons that are not the originals
cd /home/pi/.webthings/addons && find -not -path "./candleappstore*" -not -path "./candle-theme*" -not -path "./power-settings*" -not -path "./webinterface*" -not -path "./zigbee2mqtt-adapter*" -not -path "./hotspot*" -not -path "./followers*" -not -path "./privacy-manager*" -not -path "./photo-frame*" -not -path "./welcome*" -not -path "./network-presence-detection-adapter*" -not -path "./internet-radio*"  -not -path "./bluetoothpairing*" -not -path "./scenes*" -delete
cd /home/pi/.webthings/data && find -not -path "./candleappstore*" -not -path "./candle-theme*" -not -path "./power-settings*" -not -path "./webinterface*" -not -path "./zigbee2mqtt-adapter*" -not -path "./hotspot*" -not -path "./followers*" -not -path "./privacy-manager*" -not -path "./photo-frame*" -not -path "./welcome*" -not -path "./network-presence-detection-adapter*" -not -path "./internet-radio*"  -not -path "./bluetoothpairing*" -not -path "./scenes*" -delete

# clear Bash history
echo "Well hello there" > /home/pi/.bash_history
#cat /dev/null > /home/pi/.bash_history

# clear syslog
truncate -s 0 /var/log/syslog
rm /var/log/syslog.1
systemd-tmpfiles --clean
systemd-tmpfiles --remove

#RESETZ2M=$1

#if [ "$RESETZ2M" == "true" ]; then

if [ -f "/boot/keep_z2m.txt" ]; then
    echo "Factory reset is allowing Zigbee2MQTT to remain"
else
    echo "Factory reset: also resetting Zigbee2MQTT"
    rm /home/pi/.webthings/data/zigbee2mqtt-adapter/*.db
    rm /home/pi/.webthings/data/zigbee2mqtt-adapter/*.yaml
    rm /home/pi/.webthings/data/zigbee2mqtt-adapter/*.json
    rm /home/pi/.webthings/data/zigbee2mqtt-adapter/database.db.backup
fi


if [ -f "/boot/keep_bluetooth.txt" ]; then
    echo "Factory reset is allowing Bluetooth devices to remain paired"
else
    echo "Factory reset: also removing Bluetooth pairings"
    rm -rf /home/pi/.webthings/var/lib/bluetooth/*
fi


# Try to create the hostname symbolic links
echo "candle" > /home/pi/.webthings/etc/hostname
echo "127.0.0.1	localhost\n::1		localhost ip6-localhost ip6-loopback\nff02::1		ip6-allnodes\nff02::2		ip6-allrouters\n\n127.0.1.1	candle" > /home/pi/.webthings/etc/hosts
rm /etc/hostname
rm /etc/hosts
ln -s /home/pi/.webthings/etc/hostname /etc/hostname
ln -s /home/pi/.webthings/etc/hosts /etc/hosts


# Disable SSH access
raspi-config nonint do_ssh 1 # 0 is enable, 1 is disable

#raspi-config --enable-overlayfs
#raspi-config nonint do_overlayfs 0 # 0 is enable
#mount -o remount,rw /boot
#shutdown +1
raspi-config nonint disable_bootro
raspi-config nonint enable_overlayfs
raspi-config nonint disable_bootro

echo "waiting 15 seconds"
sleep 15

echo "DONE. Shutting down.."
rm /boot/bootup_actions.sh
shutdown -P now