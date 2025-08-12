cd /root/apps/privated-projects/boostpub/boostpub-monitor
# cp ..env.test ../
# cp ..env.prod ../

rm  ./boostpub-monitor -rf
echo '--------------1. CLONING PROJECT----------------------'
git clone git@github.com:MUHESI/boostpub-monitor.git 

cd boostpub-monitor
# cp ../.env.prod ./.env
echo '--------------2. INSTALL LIBS STARTING----------------------'
yarn install

echo ' Build successful 🎉'
echo '--------------4. BUILD SUCCESSFUL🎉 && MOVE APP TO APACHE2 FOLDER----------------------'
echo '--------------4. DELETE  dist, node_modules and package.json IN /var/www/node-apps ....----------------------'

echo '---------------------pm2 restart boostpub-monitor-------------------------'

pm2 start main.js --name boostpub-monitor

pm2 save    

# pm2 restart boostpub-monitor
pm2 logs boostpub-monitor --lines 300


