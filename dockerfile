#start from a node 22 image, sets working directory, copies package.json file, installs dependencies, copies code, exposes port and starts the app
#image version
FROM node:22

#creates the app and gives the container a clean working directory for the project files & commands
WORKDIR /app 

#This allows Docker to cache the dependency-install layer when source files change but dependencies do not. That speeds up rebuilds
COPY package*.json ./ 

#install dependencies needed by container at runtime
RUN npm install 

#copies project files, copy after installing dep. bcz it helps docker layer caching and avoids reinstalling dependencies everytime src files change
COPY . .

#port
EXPOSE 8080

#default command to run dev server inside container(api) for local dev and testing
CMD ["npm", "run", "dev"]

#improvement ideas:
    #use npm ci instead of npm install for faster/cleaner automated builds bcz it gives deterministic installs based on the lockfile