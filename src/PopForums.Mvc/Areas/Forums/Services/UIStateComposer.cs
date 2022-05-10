﻿using PopForums.Mvc.Models;

namespace PopForums.Mvc.Areas.Forums.Services;

public interface IUIStateComposer
{
	Task<UIState> GetState();
}

public class UIStateComposer : IUIStateComposer
{
	private readonly IUserRetrievalShim _userRetrievalShim;
	private readonly IPrivateMessageService _privateMessageService;

	public UIStateComposer(IUserRetrievalShim userRetrievalShim, IPrivateMessageService privateMessageService)
	{
		_userRetrievalShim = userRetrievalShim;
		_privateMessageService = privateMessageService;
	}

	public async Task<UIState> GetState()
	{
		var state = new UIState();
		var user = _userRetrievalShim.GetUser();
		if (user != null)
		{
			state.Name = user.Name;
			state.UserID = user.UserID;
			state.NewPmCount = await _privateMessageService.GetUnreadCount(user);
			state.IsLoggedIn = true;
			state.IsAdmin = user.IsInRole(PermanentRoles.Admin);
		}
		return state;
	}
}