#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Please run with sudo"
  exit
fi


if [ -f /boot/write_enabled.txt ] 
then

  rm /boot/write_enabled.txt
  touch /home/pi/.webthings/candle.log
  echo "$(date) - manual update" >> /home/pi/.webthings/candle.log

  apt-get update
  apt-get upgrade

  # Re-nable read-only mode of system partition
  raspi-config nonint disable_bootro
  raspi-config nonint enable_overlayfs
  raspi-config nonint disable_bootro

  # delete this script
  rm /boot/bootup_actions.sh

else

  raspi-config nonint disable_bootro
  raspi-config nonint disable_overlayfs
  raspi-config nonint disable_bootro
  touch /boot/write_enabled.txt
fi

reboot
