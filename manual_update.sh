#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run with sudo"
  exit
fi


if [ -f /boot/candle_rw_once.txt ] 
then

  touch /home/pi/.webthings/candle.log
  echo "$(date) - starting manual update" >> /home/pi/.webthings/candle.log

  apt-get update
  apt-get upgrade -y &
  wait
  
  apt-get update --fix-missing -y
  apt --fix-broken install -y
  apt autoremove -y
  
  echo "$(date) - manual update complete" >> /home/pi/.webthings/candle.log
  
  rm /boot/candle_rw_once.txt
  
fi

# delete this script
rm /boot/bootup_actions.sh

reboot
