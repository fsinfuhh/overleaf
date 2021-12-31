FROM registry.mafiasi.de/sharelatex:main

RUN tlmgr update --self --all
RUN tlmgr install scheme-full
# For copyright reasons, this file cannot be added to the git
ADD texmf-local.tgz /usr/local/texlive/

COPY services/web/app/views/user/login.pug /var/www/sharelatex/web/app/views/user/login.pug
COPY server-ce/settings.js /etc/sharelatex/settings.js
COPY services/web/app/src/infrastructure/Server.js /var/www/sharelatex/web/app/src/infrastructure/Server.js
COPY services/web/app/src/Features/Authentication/AuthenticationManager.js /var/www/sharelatex/web/app/src/Features/Authentication/AuthenticationManager.js
COPY services/web/app/src/Features/Authentication/AuthenticationController.js /var/www/sharelatex/web/app/src/Features/Authentication/AuthenticationController.js
RUN chmod o+r -R /var/www/sharelatex/web
RUN chmod o+r /etc/sharelatex/settings.js
