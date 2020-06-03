TARGETS = console-setup mountkernfs.sh alsa-utils ebtables ufw pppd-dns hostname.sh screen-cleanup dns-clean plymouth-log x11-common udev mountdevsubfs.sh resolvconf brltty procps qemu-kvm hwclock.sh checkroot.sh cryptdisks-early cryptdisks networking iscsid lvm2 checkfs.sh rpcbind urandom open-iscsi bootmisc.sh kmod mountnfs.sh mountnfs-bootclean.sh mountall.sh checkroot-bootclean.sh mountall-bootclean.sh
INTERACTIVE = console-setup udev checkroot.sh cryptdisks-early cryptdisks checkfs.sh
udev: mountkernfs.sh
mountdevsubfs.sh: mountkernfs.sh udev
resolvconf: dns-clean
brltty: mountkernfs.sh udev
procps: mountkernfs.sh udev
qemu-kvm: mountkernfs.sh udev
hwclock.sh: mountdevsubfs.sh
checkroot.sh: hwclock.sh mountdevsubfs.sh hostname.sh
cryptdisks-early: checkroot.sh udev
cryptdisks: checkroot.sh cryptdisks-early udev lvm2
networking: mountkernfs.sh urandom resolvconf procps dns-clean
iscsid: networking
lvm2: cryptdisks-early mountdevsubfs.sh udev
checkfs.sh: cryptdisks checkroot.sh lvm2
rpcbind: networking
urandom: hwclock.sh
open-iscsi: networking iscsid
bootmisc.sh: udev mountnfs-bootclean.sh checkroot-bootclean.sh mountall-bootclean.sh
kmod: checkroot.sh
mountnfs.sh: networking rpcbind
mountnfs-bootclean.sh: mountnfs.sh
mountall.sh: checkfs.sh checkroot-bootclean.sh lvm2
checkroot-bootclean.sh: checkroot.sh
mountall-bootclean.sh: mountall.sh
