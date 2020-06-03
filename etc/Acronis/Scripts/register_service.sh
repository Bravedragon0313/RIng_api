#!/bin/bash

MYNAME="$0"
MYDIR=`dirname $MYNAME`

usage() {
	echo $"Usage: $MYNAME {preinst|postinst|preuninst}"
	exit 1
}

# preinst postinst preuninst
COMMAND="$1"; shift
SERVICE_NAME="$1"; shift
test -z "$SERVICE_NAME" && usage

test -e /run/systemd/system/ && USE_SYSTEMD="yes"

preinst_chkconfig() {
	CHKCONFIG="/usr/sbin/update-rc.d -f $SERVICE_NAME remove"
	test -e /sbin/chkconfig && CHKCONFIG="/sbin/chkconfig --del $SERVICE_NAME"
	if [ -e /etc/init.d/$SERVICE_NAME ]; then
		/etc/init.d/$SERVICE_NAME stop >/dev/null 2>&1 || true
		${CHKCONFIG} >/dev/null 2>&1 || true
	fi
}

postinst_chkconfig() {
	CHKCONFIG="/usr/sbin/update-rc.d $SERVICE_NAME defaults"
	test -e /sbin/chkconfig && CHKCONFIG="/sbin/chkconfig --add $SERVICE_NAME"
	${CHKCONFIG} >/dev/null 2>&1 || true
}

preuninst_chkconfig() {
	CHKCONFIG="/usr/sbin/update-rc.d -f $SERVICE_NAME remove"
	test -e /sbin/chkconfig && CHKCONFIG="chkconfig --del $SERVICE_NAME"
	/etc/init.d/$SERVICE_NAME stop >/dev/null 2>&1 || true
	${CHKCONFIG} >/dev/null 2>&1 || true
	rm -f /etc/init.d/$SERVICE_NAME >/dev/null 2>&1 || true
}

preinst_systemd() {
	if [ -e /etc/init.d/$SERVICE_NAME ]; then
		# update from prev version
		preinst_chkconfig
	fi
	systemctl disable $SERVICE_NAME.service >/dev/null 2>&1 || true
	systemctl stop $SERVICE_NAME.service >/dev/null 2>&1 || true
}

postinst_systemd() {
	if [ -e /etc/init.d/$SERVICE_NAME ]; then
		rm -f /etc/init.d/$SERVICE_NAME >/dev/null 2>&1 || true
	fi
	if [ -e /etc/systemd/system/$SERVICE_NAME.service ]; then
		local service_home="`grep WorkingDirectory /etc/systemd/system/$SERVICE_NAME.service 2> /dev/null | cut -f 2 -d =`"
		[ -n "$service_home" ] && mkdir -p "$service_home" >/dev/null 2>&1 || true
	fi
	systemctl daemon-reload >/dev/null 2>&1 || true
	systemctl enable $SERVICE_NAME.service >/dev/null 2>&1 || true
}

preuninst_systemd() {
	systemctl disable $SERVICE_NAME.service >/dev/null 2>&1 || true
	systemctl stop $SERVICE_NAME.service >/dev/null 2>&1 || true
}

case $COMMAND in
    preinst)
	if [ -z "$USE_SYSTEMD" ]; then
		preinst_chkconfig
	else
		preinst_systemd
	fi
	;;
    postinst)
	if [ -z "$USE_SYSTEMD" ]; then
		postinst_chkconfig
	else
		postinst_systemd
	fi
	;;
    preuninst)
	if [ -z "$USE_SYSTEMD" ]; then
		preuninst_chkconfig
	else
		preuninst_systemd
	fi
	;;
    *)
	usage
	;;
esac

exit 0
