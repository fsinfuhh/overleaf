FROM registry.mafiasi.de/sharelatex:main

RUN tlmgr update --self --all
RUN tlmgr install scheme-full

COPY services/web/app/views/user/login.pug /var/www/sharelatex/web/app/views/user/login.pug
COPY services/web/app/views/user/settings.pug /var/www/sharelatex/web/app/views/user/settings.pug
#COPY services/web/config/settings.defaults.js /var/www/sharelatex/web/config/settings.defaults.js
COPY server-ce/settings.js /etc/sharelatex/settings.js
COPY services/web/app/src/infrastructure/Server.js /var/www/sharelatex/web/app/src/infrastructure/Server.js
COPY services/web/app/src/Features/Authentication/AuthenticationManager.js /var/www/sharelatex/web/app/src/Features/Authentication/AuthenticationManager.js
COPY services/web/app/src/Features/Authentication/AuthenticationController.js /var/www/sharelatex/web/app/src/Features/Authentication/AuthenticationController.js
RUN chmod o+r -R /var/www/sharelatex/web
RUN chmod o+r /etc/sharelatex/settings.js
