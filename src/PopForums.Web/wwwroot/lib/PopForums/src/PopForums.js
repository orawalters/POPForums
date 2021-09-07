﻿var ready = (callback) => {
	if (document.readyState != "loading") callback();
	else document.addEventListener("DOMContentLoaded", callback);
}

var PopForums = {};

PopForums.areaPath = "/Forums";
PopForums.currentTopicState = null;
PopForums.editorCSS = "/lib/bootstrap/dist/css/bootstrap.min.css,/lib/PopForums/dist/Editor.min.css";
PopForums.postNoImageToolbar = "cut copy paste | bold italic | bullist numlist blockquote removeformat | link";

PopForums.editorSettings = {
	theme: "silver",
	plugins: "paste lists image link",
	content_css: PopForums.editorCSS,
	menubar: false,
	toolbar: "cut copy paste | bold italic | bullist numlist blockquote removeformat | link | image",
	statusbar: false,
	target_list: false,
	link_title: false,
	image_description: false,
	image_dimensions: false,
	browser_spellcheck : true,
	object_resizing: false,
	relative_urls: false,
	remove_script_host: false,
	contextmenu: "",
	mobile: {
		theme: "silver"
	},
	paste_as_text: true
};

PopForums.processLogin = function () {
	PopForums.processLoginBase("/Identity/Login");
};

PopForums.processLoginExternal = function () {
	PopForums.processLoginBase("/Identity/LoginAndAssociate");
};

PopForums.processLoginBase = function (path) {
	var email = document.querySelector("#EmailLogin").value;
	var password = document.querySelector("#PasswordLogin").value;
	fetch(PopForums.areaPath + path, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ email: email, password: password })
	})
		.then(function(response) {
			return response.json();
	})
		.then(function (result) {
			var loginResult = document.querySelector("#LoginResult");
			switch (result.result) {
			case true:
				var destination = document.querySelector("#Referrer").value;
				location = destination;
				break;
			default:
				loginResult.innerHTML = result.message;
				loginResult.classList.remove("d-none");
			}
	})
		.catch(function (error) {
			var loginResult = document.querySelector("#LoginResult");
			loginResult.innerHTML = "There was an unknown error while attempting login";
			loginResult.classList.remove("d-none");
	});
};

PopForums.scrollToPostFromHash = () => {
	if (window.location.hash) {
		var hash = window.location.hash;
		while (hash.charAt(0) === '#') hash = hash.substr(1);
		var tag = document.querySelector("div[data-postID='" + hash + "']");
		if (tag) {
			var tagPosition = tag.getBoundingClientRect().top;
			var crumb = document.querySelector("#ForumContainer #TopBreadcrumb");
			var crumbHeight = crumb.getBoundingClientRect().height;
			var e = getComputedStyle(document.querySelector(".postItem"));
			var margin = parseFloat(e.marginTop, 10);
			var newPosition = tagPosition - crumbHeight - margin;
			window.scrollBy({ top: newPosition, behavior: 'auto' });
		}
	}
};

PopForums.topicListSetup = function (forumID) {
	PopForums.startTimeUpdater();
	var b = document.querySelector("#NewTopicButton");
	b.addEventListener("click", () => {
		var n = document.querySelector("#NewTopic");
		fetch(PopForums.areaPath + "/Forum/PostTopic/" + forumID)
			.then((response) => {
				return response.text();
			})
			.then((body) => {
				n.innerHTML = body;
				n.style.display = "block"; // TODO: animate?
				b.style.display = "none";
				var allowImage = (document.querySelector("#IsImageEnabled").value.toLowerCase() == "true");
				if (!allowImage) {
					PopForums.editorSettings.toolbar = PopForums.postNoImageToolbar;
				}
				var usePlainText = (document.querySelector("#IsPlainText").value.toLowerCase() == "true");
				if (!usePlainText) {
					PopForums.editorSettings.selector = "#NewTopic #FullText";
					tinyMCE.init(PopForums.editorSettings);
				}
				$("#PreviewModal").on("shown.bs.modal", function () { // TODO: refactor for BS5
					PopForums.previewPost();
				});
			});
	});
};

PopForums.loadReply = function (topicID, postID, replyID, setupMorePosts) {
	$(window).off("scroll", PopForums.ScrollLoad);
	var n = $("#NewReply");
	var path = PopForums.areaPath + "/Forum/PostReply/" + topicID;
	if (postID != null)
		path += "?quotePostID=" + postID;
	if (replyID != null) {
		if (postID == null)
			path += "?replyID=" + replyID;
		else
			path += "&replyID=" + replyID;
	}
	n.load(path, function () {
		var allowImage = ($("#IsImageEnabled").val().toLowerCase() == "true");
		if (!allowImage) {
			PopForums.editorSettings.toolbar = PopForums.postNoImageToolbar;
		}
		var usePlainText = ($("#IsPlainText").val().toLowerCase() == "true");
		if (!usePlainText) {
			PopForums.editorSettings.selector = "#NewReply #FullText";
			tinyMCE.init(PopForums.editorSettings);
		}
		n.slideDown();
		$("#ReplyButton").hide();
		PopForums.scrollToElement("NewReply");
		$("#MorePostsBeforeReplyButton").click(function () {
			$.get(PopForums.areaPath + "/Forum/TopicPartial/" + topicID + "?lastPost=" + PopForums.currentTopicState.lastVisiblePost + "&lowpage=" + PopForums.currentTopicState.lowPage, function (result) {
				var stuff = $(result);
				var links = stuff.find(".pagerLinks").detach();
				var lastPostID = stuff.find(".lastPostID").detach();
				PopForums.currentTopicState.lastVisiblePost = lastPostID.val();
				var postStream = $("#PostStream");
				postStream.append(stuff);
				links.replaceAll(".pagerLinks");
				$(".postItem img:not('.avatar')").addClass("postImage");
				$(".morePostsButton").remove();
				PopForums.setReplyMorePosts(PopForums.currentTopicState.lastVisiblePost);
			});
		});

		if (setupMorePosts) {
			var connection = new signalR.HubConnectionBuilder().withUrl("/TopicsHub").build();
			connection.start()
				.then(function () {
					var result = connection.invoke("getLastPostID", topicID)
						.then(function (result) {
							PopForums.setReplyMorePosts(result);
						});
				});
		}

		$("#PreviewModal").on("shown.bs.modal", function () {
			PopForums.previewPost();
		});

		PopForums.TopicState.replyLoaded = true;
	});
};

PopForums.loadComment = function (topicID, replyID) {
	var p = $("[data-postid*='" + replyID + "']");
	var n = p.find(".commentHolder");
	var path = PopForums.areaPath + "/Forum/PostReply/" + topicID;
	if (replyID != null)
		path += "?replyID=" + replyID;
	n.load(path, function () {
		var allowImage = ($("#IsImageEnabled").val().toLowerCase() == "true");
		if (!allowImage) {
			PopForums.editorSettings.toolbar = PopForums.postNoImageToolbar;
		}
		var usePlainText = ($("#IsPlainText").val().toLowerCase() == "true");
		if (!usePlainText) {
			PopForums.editorSettings.selector = ".postForm #FullText";
			tinyMCE.init(PopForums.editorSettings);
		}
		n.slideDown();

		$("#PreviewModal").on("shown.bs.modal", function () {
			PopForums.previewPost();
		});
	});
};

PopForums.previewPost = function () {
	tinyMCE.triggerSave();
	var r = $("#ParsedFullText");
	$.ajax({
		url: PopForums.areaPath + "/Forum/PreviewText",
		type: "POST",
		data: { FullText: $(".postForm #FullText").val(), IsPlainText: $(".postForm #IsPlainText").val() },
		dataType: "json",
		converters: { "text json": true },
		success: function (result) {
			r.html(result);
		},
		error: function () {
			r.html("There was a problem getting the preview.");
		}
	});
};

PopForums.loadFeed = function () {
	var connection = new signalR.HubConnectionBuilder().withUrl("/FeedHub").build();
	connection.on("notifyFeed", function (data) {
		var list = $("#FeedList");
		var row = PopForums.populateFeedRow(data);
		list.prepend(row);
		row.fadeIn();
	});
	connection.start()
		.then(function () {
			return connection.invoke("listenToAll");
		});
	PopForums.startTimeUpdater();
};

PopForums.populateFeedRow = function (data) {
	var row = $("#ActivityFeedTemplate").clone();
	row.removeAttr("id");
	row.find(".feedItemText").html(data.message);
	row.find(".fTime").attr("data-utc", data.utc);
	row.find(".fTime").text(data.timeStamp);
	return row;
};

PopForums.setReplyMorePosts = function (lastPostID) {
	var lastPostLoaded = lastPostID == PopForums.currentTopicState.lastVisiblePost;
	if (lastPostLoaded)
		$("#MorePostsBeforeReplyButton").css("visibility", "hidden");
	else
		$("#MorePostsBeforeReplyButton").css("visibility", "visible");
};

PopForums.topicSetup = function (topicID, pageIndex, pageCount, replyID) {
	PopForums.startTimeUpdater();
	var lastPostID = $("#LastPostID").val();
	PopForums.currentTopicState = new PopForums.TopicState(pageIndex, lastPostID, pageCount, topicID);

	var connection = new signalR.HubConnectionBuilder().withUrl("/TopicsHub").build();
	connection.on("fetchNewPost", function (postID) {
		if (!PopForums.TopicState.replyLoaded && PopForums.currentTopicState.highPage == PopForums.currentTopicState.pageCount) {
			$.get(PopForums.areaPath + "/Forum/Post/" + postID, function (data) {
				var post = $(data);
				post.appendTo("#PostStream");
			});
			$("#LastPostID").val(postID);
			PopForums.currentTopicState.lastVisiblePost = postID;
		}
	});
	connection.on("notifyNewPosts", function (theLastPostID) {
		PopForums.setReplyMorePosts(theLastPostID);
	});
	connection.start()
		.then(function () {
			return connection.invoke("listenTo", topicID);
		});

	$(".postItem img:not('.avatar')").addClass("postImage");

	document.querySelector("#ReplyButton").addEventListener("click", event => {
		PopForums.loadReply(topicID, null, replyID, true);
	});
	document.querySelector("#PostStream").addEventListener("click", event => {
		if (event.target.classList.contains("replyLink")) {
			PopForums.loadReply(topicID, null, replyID, true);
		}
	});
	document.querySelector("#PostStream").addEventListener("click", event => {
		if (event.target.classList.contains("quoteLink")) {
			var postID = event.target.closest(".postItem").getAttribute("data-postID");
			PopForums.loadReply(topicID, postID, replyID, true);
		}
	});
	document.querySelector("#PostStream").addEventListener("click", event => {
		if (event.target.classList.contains("postNameLink")) {
			var box = event.target.closest(".postItem").querySelector(".miniProfileBox");
			var userID = event.target.closest(".postItem").getAttribute("data-userID");
			PopForums.loadMiniProfile(userID, box);
		}
	});
	$(document).on("click", ".voteCount", function () {
		var parent = $(this).parents(".postItem");
		var postID = parent.attr("data-postID");
		parent.find(".voters").slideDown(function () {
			$(this).load(PopForums.areaPath + "/Forum/Voters/" + postID);
			$(this).mouseleave(function () {
				$(this).hide();
			});
			$(this).css("display", "block");
		}).css("display", "block");
	});
	$(document).on("click", ".voteUp", function () {
		var parent = $(this).parents(".postItem");
		var postID = parent.attr("data-postID");
		var countBox = $(this).closest(".postToolContainer").children(".voteCount");
		$.ajax({
			url: PopForums.areaPath + "/Forum/VotePost/" + postID,
			type: "POST",
			success: function (result) {
				countBox.html(result);
				var voted = parent.find(".voteUp");
				voted.replaceWith('<li class="list-inline-item">Voted</li>');
			}
		});
	});
	PopForums.SetupSubscribeButton(topicID);
	PopForums.SetupFavoriteButton(topicID);
	$("#TopicModLogButton").click(function () {
		var l = $("#TopicModerationLog");
		if (l.is(":hidden"))
			l.load(PopForums.areaPath + "/Moderator/TopicModerationLog/" + topicID, function () {
				l.slideDown();
			});
		else l.slideUp();
	});
	$(document).on("click", ".postModLogButton", function () {
		var id = $(this).attr("data-postID");
		var l = $(this).closest(".postToolContainer").find(".moderationLog");
		if (l.is(":hidden"))
			l.load(PopForums.areaPath + "/Moderator/PostModerationLog/" + id, function () {
				l.slideDown();
			});
		else l.slideUp();
	});
	$(document).on("click", ".morePostsButton", function () {
		PopForums.LoadMorePosts(topicID, this);
	});
	$(document).on("click", ".previousPostsButton", function () {
		PopForums.currentTopicState.addStartPage();
		var nextPage = PopForums.currentTopicState.lowPage;
		var id = topicID;
		var postStream = $("#PostStream");
		var button = $(this).detach();
		$.get(PopForums.areaPath + "/Forum/TopicPage/" + id + "?pageNumber=" + nextPage + "&low=" + PopForums.currentTopicState.lowPage + "&high=" + PopForums.currentTopicState.highPage, function (result) {
			var stuff = $(result);
			var links = stuff.find(".pagerLinks").detach();
			postStream.prepend(stuff);
			links.replaceAll(".pagerLinks");
			if (PopForums.currentTopicState.lowPage > 1)
				postStream.prepend(button);
			$(".postItem img:not('.avatar')").addClass("postImage");
			if (PopForums.currentTopicState.highPage == PopForums.currentTopicState.pageCount && PopForums.currentTopicState.lowPage == 1) {
				$(".pagerLinks").remove();
			}
		});
	});
	PopForums.scrollToPostFromHash();
	$(window).on("scroll", PopForums.ScrollLoad);
};

PopForums.qaTopicSetup = function (topicID) {
	PopForums.startTimeUpdater();

	$(".postItem img:not('.avatar')").addClass("postImage");

	document.querySelector("#PostStream").addEventListener("click", event => {
		if (event.target.classList.contains("commentLink")) {
			var replyID = event.target.closest(".postItem").getAttribute("data-postid");
			PopForums.loadComment(topicID, replyID);
		}
	});
	document.querySelector("#ReplyButton").addEventListener("click", event => {
		var replyID = event.target.closest(".postContainer").getAttribute("data-postid");
		PopForums.loadReply(topicID, null, replyID);
	});
	document.querySelector("#PostStream").addEventListener("click", event => {
		if (event.target.classList.contains("postNameLink")) {
			var box = event.target.closest(".postUserData").querySelector(".miniProfileBox");
			var userID = event.target.closest(".postUserData").getAttribute("data-userID");
			PopForums.loadMiniProfile(userID, box);
		}
	});
	$(document).on("click", ".voteUp", function () {
		var parent = $(this).parents(".postItem");
		var postID = parent.attr("data-postid");
		var countBox = $(this).parents(".answerData").find(".badge");
		$.ajax({
			url: PopForums.areaPath + "/Forum/VotePost/" + postID,
			type: "POST",
			success: function (result) {
				countBox.html(result);
				var voted = parent.find(".voteUp");
				voted.html("Voted");
				voted.removeClass("btn-link");
			}
		});
	});
	$(document).on("click", ".answerButton", function () {
		var button = $(this);
		var parent = button.parents(".postItem");
		var postID = parent.attr("data-postid");
		var topicID = parent.attr("data-topicid");
		$.ajax({
			url: PopForums.areaPath + "/Forum/SetAnswer/",
			type: "POST",
			data: {postID: postID, topicID: topicID},
			success: function () {
				$(".answerStatus").removeClass("icon-checkmark text-success").addClass("icon-checkmark2 text-muted");
				button.removeClass("icon-checkmark2 text-muted").addClass("icon-checkmark text-success");
			}
		});
	});
	PopForums.SetupSubscribeButton(topicID);
	PopForums.SetupFavoriteButton(topicID);
	$("#TopicModLogButton").click(function () {
		var l = $("#TopicModerationLog");
		if (l.is(":none"))
			l.load(PopForums.areaPath + "/Moderator/TopicModerationLog/" + topicID, function () {
				l.slideDown();
			});
		else l.slideUp();
	});
	$(document).on("click", ".postModLogButton", function () {
		var id = $(this).attr("data-postID");
		var l = $(this).closest(".postToolContainer").find(".moderationLog");
		if (l.is(":hidden"))
			l.load(PopForums.areaPath + "/Moderator/PostModerationLog/" + id, function () {
				l.slideDown();
			});
		else l.slideUp();
	});
};

PopForums.SetupSubscribeButton = function (topicID) {
	var s = $("#SubscribeButton");
	s.click(function () {
		var asyncResult = $("#AsyncResponse");
		$.ajax({
			url: PopForums.areaPath + "/Subscription/ToggleSubscription/" + topicID,
			type: "POST",
			dataType: "json",
			success: function (result) {
				switch (result.data.isSubscribed) {
					case true:
						s.val("Unsubscribe");
						break;
					case false:
						s.val("Subscribe");
						break;
					default:
						asyncResult.html(result.Message);
				}
			},
			error: function () {
				asyncResult.html("There was an unknown error while attempting to use subscription");
			}
		});
	});
};

PopForums.SetupFavoriteButton = function(topicID) {
	var f = $("#FavoriteButton");
	f.click(function () {
		var asyncResult = $("#AsyncResponse");
		$.ajax({
			url: PopForums.areaPath + "/Favorites/ToggleFavorite/" + topicID,
			type: "POST",
			dataType: "json",
			success: function (result) {
				switch (result.data.isFavorite) {
					case true:
						f.val("Remove From Favorites");
						break;
					case false:
						f.val("Make Favorite");
						break;
					default:
						asyncResult.html(result.Message);
				}
			},
			error: function () {
				asyncResult.html("There was an unknown error while attempting to use favorites");
			}
		});
	});
};

PopForums.ScrollLoad = function () {
	var win = $(window);
	var streamEnd = $("#StreamBottom").offset().top;
	var viewEnd = win.scrollTop() + win.height();
	var distance = streamEnd - viewEnd;
	if (!PopForums.currentTopicState.loadingPosts && distance < 250 && PopForums.currentTopicState.highPage < PopForums.currentTopicState.pageCount) {
		PopForums.currentTopicState.loadingPosts = true;
		var button = $(".morePostsButton");
		PopForums.LoadMorePosts(PopForums.currentTopicState.topicID, button);
	}
};

PopForums.LoadMorePosts = function (topicID, clickedButton) {
	PopForums.currentTopicState.addEndPage();
	var nextPage = PopForums.currentTopicState.highPage;
	var id = topicID;
	var postStream = $("#PostStream");
	var button = $(clickedButton).detach();
	$.get(PopForums.areaPath + "/Forum/TopicPage/" + id + "?pageNumber=" + nextPage + "&low=" + PopForums.currentTopicState.lowPage + "&high=" + PopForums.currentTopicState.highPage, function (result) {
		var stuff = $(result);
		var links = stuff.find(".pagerLinks").detach();
		var newLastPostID = stuff.find(".lastPostID").detach();
		var newPageCount = stuff.find(".pageCount").detach();
		PopForums.currentTopicState.lastVisiblePost = newLastPostID.val();
		PopForums.currentTopicState.pageCount = newPageCount.val();
		stuff = $("<div>").append(stuff);
		postStream.append(stuff);
		links.replaceAll(".pagerLinks");
		if (PopForums.currentTopicState.highPage != PopForums.currentTopicState.pageCount)
			postStream.append(button);
		if (PopForums.currentTopicState.highPage == PopForums.currentTopicState.pageCount && PopForums.currentTopicState.lowPage == 1) {
			$(".pagerLinks").remove();
		}
		$(".postItem img:not('.avatar')").addClass("postImage");
		PopForums.currentTopicState.loadingPosts = false;
		if (!PopForums.currentTopicState.isScrollAdjusted) {
			PopForums.scrollToPostFromHash();
			PopForums.currentTopicState.isScrollAdjusted = true;
		}
	});
};

PopForums.TopicState = function (startPageIndex, lastVisiblePost, pageCount, topicID) {
	this.lowPage = startPageIndex;
	this.highPage = startPageIndex;
	this.lastVisiblePost = lastVisiblePost;
	this.pageCount = pageCount;
	this.loadingPosts = false;
	this.topicID = topicID;
	this.replyLoaded = false;
	this.isScrollAdjusted = false;
};
PopForums.TopicState.prototype.addEndPage = function () { this.highPage++; };
PopForums.TopicState.prototype.addStartPage = function () { this.lowPage--; };

PopForums.postNewTopic = function () {
	tinyMCE.triggerSave();
	const d = document;
	d.querySelector("#SubmitNewTopic").setAttribute("disabled", "disabled");
	var model = {
		Title: d.querySelector("#NewTopic #Title").value,
		FullText: d.querySelector("#NewTopic #FullText").value,
		IncludeSignature: d.querySelector("#NewTopic #IncludeSignature").checked,
		ItemID: d.querySelector("#NewTopic #ItemID").value,
		IsPlainText: d.querySelector("#NewTopic #IsPlainText").value
	};
	fetch(PopForums.areaPath + "/Forum/PostTopic", {
		method: "POST",
		body: JSON.stringify(model),
		headers: {
			"Content-Type": "application/json"
		},
	})
		.then(response => response.json())
		.then(result => {
			switch (result.result) {
				case true:
					window.location = result.redirect;
					break;
				default:
					var r = d.querySelector("#PostResponseMessage");
					r.innerHTML = result.message;
					d.querySelector("#SubmitNewTopic").removeAttribute("disabled");
					r.style.display = "block";
			}
		})
		.catch(error => {
			var r = d.querySelector("#PostResponseMessage");
			r.innerHTML = "There was an unknown error while trying to post";
			d.querySelector("#SubmitNewTopic").removeAttribute("disabled");
			r.style.display = "block";
		});
};

PopForums.postReply = function () {
	tinyMCE.triggerSave();
	const d = document;
	d.querySelector("#SubmitReply").setAttribute("disabled", "disabled");
	var model = {
		Title: d.querySelector("#NewReply #Title").value,
		FullText: d.querySelector("#NewReply #FullText").value,
		IncludeSignature: d.querySelector("#NewReply #IncludeSignature").checked,
		ItemID: d.querySelector("#NewReply #ItemID").value,
		CloseOnReply: d.querySelector("#CloseOnReply").checked,
		IsPlainText: d.querySelector("#NewReply #IsPlainText").value,
		ParentPostID: d.querySelector("#NewReply #ParentPostID").value
	};
	fetch(PopForums.areaPath + "/Forum/PostReply", {
		method: "POST",
		body: JSON.stringify(model),
		headers: {
			"Content-Type": "application/json"
		},
	})
		.then(response => response.json())
		.then(result => {
			switch (result.result) {
				case true:
					window.location = result.redirect;
					break;
				default:
					var r = d.querySelector("#PostResponseMessage");
					r.innerHTML = result.message;
					d.querySelector("#SubmitReply").removeAttribute("disabled");
					r.style.display = "block";
			}
		})
		.catch(error => {
			var r = d.querySelector("#PostResponseMessage");
			r.innerHTML = "There was an unknown error while trying to post";
			d.querySelector("#SubmitReply").removeAttribute("disabled");
			r.style.display = "block";
		});
};

PopForums.loadMiniProfile = function (userID, d) {
	if (!d.classList.contains("open")) {
		fetch(PopForums.areaPath + "/Account/MiniProfile/" + userID)
			.then(response => response.text()
				.then(text => {
					var sub = d.querySelector("div");
					sub.innerHTML = text;
					const height = sub.getBoundingClientRect().height;
					d.style.height = `${height}px`;
					d.classList.add("open");
				}));
	}
	else {
		d.classList.remove("open");
		d.style.height = 0;
	}
};

PopForums.scrollToElement = function (id) {
	var e = document.getElementById(id);
	var t = 0;
	if (e.offsetParent) {
		while (e.offsetParent) {
			t += e.offsetTop;
			e = e.offsetParent;
		}
	} else if (e.y) {
		t += e.y;
	}
	var crumb = $("#TopBreadcrumb");
	if (crumb)
		t -= crumb.outerHeight();
	scrollTo(0, t);
};

PopForums.homeSetup = function () {
	var connection = new signalR.HubConnectionBuilder().withUrl("/ForumsHub").build();
	connection.on("notifyForumUpdate", function (data) {
		PopForums.updateForumStats(data);
	});
	connection.start()
		.then(function () {
			return connection.invoke("listenToAll");
		});
	PopForums.startTimeUpdater();
};

PopForums.recentListen = function (pageSize) {
	var connection = new signalR.HubConnectionBuilder().withUrl("/RecentHub").build();
	connection.on("notifyRecentUpdate", function (data) {
		var removal = document.querySelector('#TopicList tr[data-topicID="' + data.topicID + '"]');
		if (removal) {
			removal.remove();
		} else {
			var rows = document.querySelectorAll("#TopicList tr:not(#TopicTemplate)");
			if (rows.length == pageSize)
				rows[rows.length - 1].remove();
		}
		var row = PopForums.populateTopicRow(data);
		row.classList.remove("hidden");
		document.querySelector("#TopicList").prepend(row);
	});
	connection.start()
		.then(function () {
			return connection.invoke("register");
		});
};

PopForums.forumListen = function (pageSize, forumID) {
	var connection = new signalR.HubConnectionBuilder().withUrl("/ForumsHub").build();
	connection.on("notifyUpdatedTopic", function (data) {
		var removal = document.querySelector('#TopicList tr[data-topicID="' + data.topicID + '"]');
		if (removal) {
			removal.remove();
		} else {
			var rows = document.querySelectorAll("#TopicList tr:not(#TopicTemplate)");
			if (rows.length == pageSize)
				rows[rows.length - 1].remove();
		}
		var row = PopForums.populateTopicRow(data);
		row.classList.remove("hidden");
		document.querySelector("#TopicList").prepend(row);
	});
	connection.start()
		.then(function () {
			return connection.invoke("listenTo", forumID);
		});
};

PopForums.populateTopicRow = function (data) {
	var row = document.querySelector("#TopicTemplate").cloneNode(true);
	row.setAttribute("data-topicid", data.topicID);
	row.removeAttribute("id");
	row.querySelector(".startedByName").innerHTML = data.startedByName;
	row.querySelector(".indicatorLink").setAttribute("href", data.link);
	row.querySelector(".titleLink").innerHTML = data.title;
	row.querySelector(".titleLink").setAttribute("href", data.link);
	var forumTitle = row.querySelector(".forumTitle");
	if (forumTitle) forumTitle.innerHTML = data.forumTitle;
	row.querySelector(".viewCount").innerHTML = data.viewCount;
	row.querySelector(".replyCount").innerHTML = data.replyCount;
	row.querySelector(".lastPostTime").innerHTML = data.lastPostTime;
	row.querySelector(".lastPostName").innerHTML = data.lastPostName;
	row.querySelector(".fTime").setAttribute("data-utc", data.utc);
	return row;
};

PopForums.updateForumStats = function (data) {
	var row = document.querySelector("[data-forumid='" + data.forumID + "']");
	row.querySelector(".topicCount").innerHTML = data.topicCount;
	row.querySelector(".postCount").innerHTML = data.postCount;
	row.querySelector(".lastPostTime").innerHTML = data.lastPostTime;
	row.querySelector(".lastPostName").innerHTML = data.lastPostName;
	row.querySelector(".fTime").setAttribute("data-utc", data.utc);
	row.querySelector(".newIndicator .icon-file-text2").classList.remove("text-muted");
	row.querySelector(".newIndicator .icon-file-text2").classList.add("text-warning");
};

PopForums.startTimeUpdater = function () {
	setTimeout(function () {
		PopForums.startTimeUpdater();
		PopForums.updateTimes();
	}, 60000);
};

PopForums.updateTimes = function () {
	var a = [];
	var times = document.querySelectorAll(".fTime");
	times.forEach(time => {
		var t = time.getAttribute("data-utc");
		if (((new Date() - new Date(t + "Z")) / 3600000) < 48)
			a.push(t);
	});
	if (a.length > 0) {
		var formData = new FormData();
		a.forEach(t => formData.append("times", t));
		fetch(PopForums.areaPath + "/Time/GetTimes", {
			method: "POST",
			body: formData
		})
			.then(response => response.json())
			.then(data => {
				data.forEach(t => {
					document.querySelector(".fTime[data-utc='" + t.key + "']").innerHTML = t.value;
				});
			})
			.catch(error => { console.log("Time update failure: " + error); });
	}
};