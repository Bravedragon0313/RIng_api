import time
import os

fname = '/var/log/ringd.log'

def restartService():
    os.system('killall ringd')

def countLines(file):
    lines = 0
    with open(file, 'r') as f:        
        for l in f:
            lines += 1
    return lines

def readRange(file, lastline):
    lines = []
    with open(file, 'r') as f:
        for l in range(lastline):
            f.readline()
        for l in f:
            lines.append(l)
    return lines

def checkList(list, string):
    for l in list:
        if string in l:
            return True
    return False

def checkRenew():
    lines = countLines(fname)
    time.sleep(3600)
    list = readRange(fname, lines)
    
    if not checkList(list, 'renewing auth token...'):
        restartService()
        checkStart()
    else:
        checkRenew()

def checkStart():
    lines = countLines(fname)
    time.sleep(60)
    list = readRange(fname, lines)
    
    if not checkList(list, 'GCM cold startup passed'):
        restartService()
        checkStart()
    else:
        checkRenew()

checkStart()
