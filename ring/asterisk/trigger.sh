#!/bin/bash
mysql -u sigman -psigman sigman -Bse "select category,var_val from ast_config where filename = 'triggers.conf';" | sed "s/'/\'/;s/\t/,/g;s/^//;s/$//;s/\n//g" > /etc/asterisk/triggers.conf

