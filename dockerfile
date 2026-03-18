FROM node:22

#creates the app
WORKDIR /app 

COPY package*.json ./
#install dependencies
RUN npm install
#copies project files
COPY . .
#port
EXPOSE 8080
#default command
CMD ["npm", "run", "dev"]