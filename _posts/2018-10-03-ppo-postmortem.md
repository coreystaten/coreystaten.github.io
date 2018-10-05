---
layout: post
title: PPO Implementation Postmortem
---

Before I'd written any reinforcement learning code, I heard from several sources that RL algorithms were extremely finicky and difficult to debug.  After implementing some RL algorithms, I can say that this was exactly my experience -- but I still found myself surprised by the specifics.  In order to convey what "extremely finicky" feels like in practice, here's a list of many of the errors I made while [getting PPO to run on Atari games](https://github.com/coreystaten/deeprl-ppo):
* Deterministically choosing the next action by taking a max over softmax outputs, instead of stochastically choosing according to the distribution.
* Forgetting to implement checkpointing until several hours into a run which I wanted to pause and resume.
* Appending an observation to the replay buffer before checking whether the environment needed to be reset; thus the last observation of the previous episode was being recorded as the first observation of the new episode.
* Using a 1-step backup from the value estimator for value training, instead of using n-step empirical returns for the length of the update horizon.
* Normalizing advantages per agent, instead of per batch.
* Forgetting to add axis=1 to a reduce_sum, causing the whole batch to be summed to a scalar.
* Not negating the clipped loss; I had double-checked this with the PPO paper, but had not noticed that the paper was maximizing the value instead of minimizing it like I was.
* Not doing gradient clipping; I kept running into dying RelU's until I added this.  This doesn't appear to be mentioned in the PPO paper, but OpenAI's baseline also uses gradient clipping.
* Attempting to write my own "clean room" Atari wrappers.  When Pong consistently failed to converge, I eventually tried the OpenAI wrappers on a lark and found that they worked.  Some of the ways my code differed:
    * Using Pong-v0 instead of PongNoFrameskip-v4.  Pong-v0 has internal frameskip, so messes with the "max over adjacent frames" step of preprocessing.
    * Not using reward clipping.
    * Not doing the equivalent of the "fire upon environment reset" wrapper.
    * Using scikit instead of cv2 for image manipulation (probably fine).
    * Stacking observations into a (4, 84, 84) tensor instead of an (84, 84, 4) tensor, causing initial convnet layers to interpret it as a 4x84 image with 84 color channels.  I did not think this was possible since one of the convolutional layers had kernel size bigger than 4, but apparently this does not raise an exception.

My debugging process was something like:
* Looking at intermediate values in the computation graph during training, and seeing if they were the wrong shape or had unexpected/weird values.
* Making edits in areas that I felt confused about, and seeing how performance or intermediate values respond.
* Staring at code and thinking
* Re-reading the original paper and related papers.
* When really stuck, comparing with other implementations.

Overall take: this was my first "from scratch" RL implementation, and there's a ton of low-level experiential knowledge I feel like I gained from building it.  My next implementation (Rainbow) went much more smoothly, despite being twice as many lines of code.

