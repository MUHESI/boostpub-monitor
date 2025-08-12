#!/bin/bash

# Récupération des infos fixes (une fois)
cpu_cores=$(nproc)
total_ram=$(free -m | awk '/Mem:/ {print $2}')

echo "=== Monitoring CPU & RAM ==="
echo "Nombre de cœurs CPU : $cpu_cores"
echo "RAM totale : ${total_ram} MB"
echo "----------------------------"

while true; do
    echo "----- $(date) -----"
    
    # CPU usage %
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | \
      sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | \
      awk '{print 100 - $1}')
    echo "CPU Usage : $cpu_usage %"
    
    # RAM usage
    ram_usage=$(free -m | awk 'NR==2{printf "%s/%s MB (%.2f%%)", $3,$2,$3*100/$2 }')
    echo "RAM Usage : $ram_usage"
    
    echo "----------------------------"
    sleep 2
done


echo "Monitoring CPU and RAM usage. Press Ctrl+C to stop."

while true; do
    echo "----- $(date) -----"
    
    # CPU usage summary
    top -bn1 | grep "Cpu(s)" | \
      sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | \
      awk '{print "CPU Usage: " 100 - $1 "%"}'
    
    # RAM usage summary
    free -m | awk 'NR==2{printf "RAM Usage: %s/%s MB (%.2f%%)\n", $3,$2,$3*100/$2 }'
    
    sleep 2
done

watch -n 2 "ps -p $(pm2 pid bpub-prod) -o %mem,rss" // directement la RAM utilisée en Mo et le pourcentage,  c'est mieux
