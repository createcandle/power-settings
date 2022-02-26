#! /bin/bash

# This script tries to restore a backup
sudo systemctl stop webthings-gateway.service
sleep 5

tar -xf /home/pi/.webthings/data/power-settings/candle_restore.tar /home/pi/.webthings/test/

sudo systemctl start webthings-gateway.service
