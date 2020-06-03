dd if=/dev/zero of=/dev/fb0
/usr/local/bin/mplayer -ao alsa:device=hw=0.3 -vf scale -zoom -xy 1800 -vo fbdev2 rtsp://admin:KyE3MEax@192.168.1.102:554/stream1
