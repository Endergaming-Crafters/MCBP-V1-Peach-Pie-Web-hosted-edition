# MCBP-V1-Peach-Pie-Web-hosted-edition
MCBP is a Minecraft bot panel capable of keeping your server running 24/7, it runs on MineFlayer for NodeJS and is easy to set up.

Dependencies install command "npm install"

Start panel command "node server.js"

Info and Set-up
This is a special version sepcifilatty made for webhosting, we highly recommend that you use a web hosting service that supports NodeJS and runs 24/7, we recommend "https://koyeb.com" for first timers, we also recommend that you set the server address in config.json and also create your users in users.json, there are two files, one in the main folder and one in the data folder, please add the users to both files, the username, password and game version are also configurable but we recommend that you keep it as it is and if your server runs PaperMC, please ensure that your server has ViaVersion and ViaBackwards installed, otherwise the bot may not work.

Starting the bot and chatting
Starting the bot simply requires you to log into the panel using the default "username: Admin and password: Administrator", from there, it will automatically load the panel, you will see three buttons, "Start, Stop and Send". The first button to press is Start, this will star the bot up and automatically send it the signal to join your server, once joined if your server has AuthMe installed, the bot will automatically execute the following command "/register (bot_password) (bot_password)" which will register the bot the first time it joins the server, the next time it joins the server, it will execute "/login (bot_password)" which will log the bot into your server, once it joined you need to set it's gamemode to spectator, if you have Multiverse Core, create a world with it and set it's default gamemode to creative or spectator to keep the bot from dying in any way possible, once that's done, you're good to go, and to chat as the bot, use the console and select the chat box, type in your text and click/tap Send.

Stopping the bot
Just press the stop button... simple.

That's all, good luck with your server!

## *Disclaimer, CraftersSpot Studios is not responsible for any misconfigurations you may have made, we are not responsible for any server destruction if you gave the bot account operator commands, if you did, you should have been more careful.*
