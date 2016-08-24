FROM ubuntu:xenial

ENV http_proxy http://wwwproxy.hud.ac.uk:3128
ENV https_proxy http://wwwproxy.hud.ac.uk:3128

# install packages required
RUN apt-get update \
	&& apt-get install --yes --force-yes --no-install-recommends \
	build-essential \
	git \
	iproute2 \
	iputils-ping \
	dnsutils \
	nano \
	vim \
	curl \
	ca-certificates \
	openssh-server \
	libtool \
	libxml2-dev \
	libssl-dev \
	automake \
	libboost-all-dev \
	python3 \
	python3-urllib3 \
	&& apt-get build-dep --yes --force-yes torque \
	&& apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# build and install torque 5 in one step
WORKDIR /
RUN git clone https://github.com/adaptivecomputing/torque.git -b 5.1.1.2 torque-src \
	&& cd torque-src \
	&& ./autogen.sh \
	&& ./configure --prefix=/usr --disable-posixmemlock --disable-cpuset \
	&& make \
	&& make install \
	&& ldconfig \
	&& cd .. \
	&& cp torque-src/torque.setup . \
	&& rm -r torque-src

# torque config
# we don't have interaction so need to fix setup script
RUN sed -i 's/-t create/-t create -f/' torque.setup \
	&& ./torque.setup root localhost \
	&& qmgr -c "set server auto_node_np=true" \
	&& rm torque.setup

# install n
WORKDIR /
RUN git clone https://github.com/tj/n.git \
	&& cd n \
	&& make \
	&& make install \
	&& cd .. \
	&& rm -r n

# use n to install node 0.10 
RUN n 0.10

# install init8js
WORKDIR /
RUN git clone https://github.com/joshiggins/init8js.git \
	&& cd init8js \
	&& git checkout -q 7bb57742578c0cdfdcfbb4a8e89a9e84801fd104
WORKDIR /init8js
RUN npm install
RUN cp -r node_modules /lib/

# install vccjs
COPY . /vccjs
WORKDIR /vccjs
RUN rm -r node_modules
RUN npm install

# install configuration files
COPY init.yml /etc/init.yml
COPY services.yml /etc/services.yml

# cluster hook scripts
RUN mkdir -p /etc/vcc/cluster-hooks.d
ADD hooks/pbsnodes.sh /etc/vcc/cluster-hooks.d/pbsnodes.sh
RUN chmod +x /etc/vcc/cluster-hooks.d/*

# service hook scripts
RUN mkdir /etc/vcc/service-hooks.d
ADD hooks/headnode.sh /etc/vcc/service-hooks.d/headnode.sh
RUN chmod +x /etc/vcc/service-hooks.d/*

WORKDIR /
#ENTRYPOINT ["node", "/init8js/init.js"]