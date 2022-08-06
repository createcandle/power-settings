#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run with sudo"
  exit
fi


if [ -f /boot/write_enabled.txt ] 
then

  rm /boot/write_enabled.txt
  touch /home/pi/.webthings/candle.log
  echo "$(date) - starting manual update" >> /home/pi/.webthings/candle.log

  apt-get update
  apt-get upgrade &
  wait
  
  echo "$(date) - manual update complete" >> /home/pi/.webthings/candle.log

fi

# delete this script
rm /boot/bootup_actions.sh

reboot
