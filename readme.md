## Commands

To create a new command, you must follow these rules.

1. You command name must be unique
2. Let say you command name is hello, then your command file name should be helloCommand.js
3. You command should be in /src/commands folder
4. The command class should have these getter
	a. description - returns what your command does in string
	b. name - returns the name of your command in string
5. Must extend BaseCommand
6. Must have run method which excepts telegraf context
7. Set `enable` class variable @ property to true allowing the command to be executed

eg.

```nodejs
const BaseCommand = requires('./BaseCommand');

class HelloCommand extends BaseCommand {
	enabled = true;

	get description() {
		return "Prints hello";
	}

	get name() {
		return "hello";
	}

	async run(ctx) {
		ctx.reply("hello");
	}

}

```

### Optional class methods

1. auth - Limits by return either true or false. Excepts a (request)[request.md] object.
2. beforeRun - Executed before the run method is called. Excepts telgraf context and next callback to continue.


```nodejs
	/* Allowing only groups to execute */
	auth(request) {
		return request.is.group;
	}

	/* Modify context before running it */
	beforeRun(ctx, next) {
		ctx.modifiedContext = () => { return "Hello };
		next(ctx);
	}
}

```


### Calling models into commands

You can load a model by calling `this.loadModel(<model name>);`. This will return model inside the models directory.


## Models

There are 2 layers of the model
1. The main model - Main interface class
2. The query layer - The abstraction class base on which engine is use

