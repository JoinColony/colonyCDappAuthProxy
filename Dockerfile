FROM node:16.16

# Copy colonyCDappAuthProxy
COPY . ./colonyCDappAuthProxy

WORKDIR /colonyCDappAuthProxy

# Install authentication proxy dependencies
RUN npm install

# Open up ports to the docker image
EXPOSE 80

# Approaching Mass Relay!
CMD npm run prod
