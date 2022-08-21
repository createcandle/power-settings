#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run with sudo"
  exit
fi

touch /home/pi/.webthings/candle.log
echo "Candle: starting manual update" >> /dev/kmsg
echo "$(date) - starting manual update" >> /home/pi/.webthings/candle.log
echo "$(date) - starting manual update" >> /boot/candle_log.txt

if [ -d /ro ]; then
    echo "Candle: ERROR, detected overlay, aborting manual update" >> /dev/kmsg
    echo "$(date) - ERROR, detected overlay, aborting manual update" >> /boot/candle_log.txt
    exit 1
fi

apt-get update -y
apt-get upgrade -y &
wait

apt-get update --fix-missing -y
apt --fix-broken install -y
apt autoremove -y


echo "Candle: manual update complete. Rebooting." >> /dev/kmsg
echo "$(date) - manual update complete" >> /home/pi/.webthings/candle.log
echo "$(date) - manual update complete" >> /boot/candle_log.txt

# delete this script
rm /boot/bootup_actions.sh
rm /boot/bootup_actions_failed.sh

reboot
