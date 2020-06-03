#!/bin/bash

rh_scripts=yes

if [ -r /etc/init.d/functions ]; then
	export SYSTEMCTL_SKIP_REDIRECT=1
	. /etc/init.d/functions
else
	rh_scripts=no
fi

if [ -r /etc/default/locale ]; then
	. /etc/default/locale
	export LANG LANGUAGE
elif [ -r /etc/environment ]; then
	. /etc/environment
	export LANG LANGUAGE
elif [ -r  /etc/sysconfig/i18n ]; then
	. /etc/sysconfig/i18n
	export LANG LANGUAGE
fi

LOCK_DIR=/var/lock/subsys

RETVAL=0

selinux_context="unconfined_t"

SERVICE_COMMAND="$1"
SERVICE_PID_FILE="/var/run/$SERVICE_NAME.pid"
SERVICE_LOCK_FILE="$LOCK_DIR/$SERVICE_NAME"

start() {
	echo -n $"Starting $SERVICE_PRODUCT: "
	local pid=0
	if [ -r "${SERVICE_PID_FILE}" ]; then
		pid=`cat ${SERVICE_PID_FILE}`
		if [ "$pid" != "0" ]; then
			kill -0 $pid > /dev/null 2>&1
			if [ $? -eq 0 ]; then
				echo $"$SERVICE_PRODUCT is already started with pid $pid"
				return 0;
			fi
		fi
	fi
	export HOME="$SERVICE_HOME_DIR"
	[ -d "$HOME" ] || mkdir -p "$HOME"
	cd "$HOME"
	if [ "$SERVICE_HOTPLUG_COMPAT" = "1" ]; then
		/usr/lib/Acronis/BackupAndRecovery/Common/hotplug_hook install
	fi
	local WRAP="/usr/lib/Acronis/Agent/daemonize"
	if [ "`cat /selinux/enforce 2>/dev/null`" == "1" ]; then
		WRAP="runcon -t $selinux_context -- $WRAP"
	fi
	if [ "$rh_scripts" == "yes" ]; then
		WRAP="daemon $WRAP"
	fi
	$WRAP /usr/sbin/$SERVICE_NAME
	RETVAL=$?
	[ -d $LOCK_DIR ] || mkdir -p $LOCK_DIR
	echo
	[ $RETVAL -eq 0 ] && touch $SERVICE_LOCK_FILE
}

stop() {
	echo -n $"Shutting $SERVICE_PRODUCT: "

  if ! [ -s $SERVICE_PID_FILE ]; then
    echo 
    return 0
  fi
  local pid=$(cat $SERVICE_PID_FILE)
  local cmd=$(cat /proc/$pid/cmdline 2>/dev/null)
  local kill9=0

  if kill -0 $pid >/dev/null 2>&1; then
    kill -TERM $pid >/dev/null 2>&1
    local i
    for i in `seq 1 50`; do
      if kill -0 $pid >/dev/null 2>&1; then
        kill9=1
        echo -n "."
        sleep 1
      else
        kill9=0
        break
      fi
    done
    if  [ $kill9 -ne 0 ] && [ "$cmd" = "$(cat /proc/$pid/cmdline 2>/dev/null)" ]; then
      kill -KILL $pid >/dev/null 2>&1
      echo -n "Service forcibly killed. "
    fi
    echo "Stopped."
  fi

  rm -f $SERVICE_PID_FILE
  if [ -f $SERVICE_LOCK_FILE ]; then
    rm -rf $SERVICE_LOCK_FILE
  fi
}

local_status() {
	local pid=0
	if [ -r "${SERVICE_PID_FILE}" ]; then
		pid=`cat ${SERVICE_PID_FILE}`
		if [ "$pid" != "0" ]; then
			kill -0 $pid > /dev/null 2>&1
			if [ $? -eq 0 ]; then
				echo $"$SERVICE_PRODUCT is running"
				return 0;
			fi
		fi
	fi
	echo $"$SERVICE_PRODUCT is stopped"
	return 1
}

case $SERVICE_COMMAND in
  start)
	start
	;;
  stop)
	stop
	;;
  restart|reload)
	stop
	start
	RETVAL=$?
	;;
  condrestart)
	if [ -f "$SERVICE_LOCK_FILE" ]; then
	    stop
	    start
	    RETVAL=$?
	fi
	;;
  status)
	local_status
	RETVAL=$?
	;;
  *)
	echo $"Usage: $0 {start|stop|restart|condrestart|status}"
	exit 1
esac

exit $RETVAL
