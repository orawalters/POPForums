﻿using PopForums.Messaging;

namespace PopForums.Sql.Repositories;

public class NotificationRepository : INotificationRepository
{
	private readonly ISqlObjectFactory _sqlObjectFactory;
	private readonly ICacheHelper _cacheHelper;

	public NotificationRepository(ISqlObjectFactory sqlObjectFactory, ICacheHelper cacheHelper)
	{
		_sqlObjectFactory = sqlObjectFactory;
		_cacheHelper = cacheHelper;
		SqlMapper.AddTypeHandler(new JsonElementTypeHandler());
	}

	private string GetCacheKey(int userID)
	{
		return "PopForums.NewNotifications." + userID;
	}

	private void RemoveCache(int userID)
	{
		var key = GetCacheKey(userID);
		_cacheHelper.RemoveCacheObject(key);
	}

	public async Task<int> UpdateNotification(Notification notification)
	{
		Task<int> total = null;
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			total = connection.ExecuteAsync("UPDATE pf_Notifications SET TimeStamp = @TimeStamp, IsRead = @IsRead, Data = @Data WHERE UserID = @UserID AND NotificationType = @NotificationType AND ContextID = @ContextID", notification));
		RemoveCache(notification.UserID);
		return await total;
	}

	public async Task CreateNotification(Notification notification)
	{
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			connection.ExecuteAsync("INSERT INTO pf_Notifications (UserID, NotificationType, ContextID, TimeStamp, IsRead, Data) VALUES (@UserID, @NotificationType, @ContextID, @TimeStamp, @IsRead, @Data)", notification));
		RemoveCache(notification.UserID);
	}

	public async Task MarkNotificationRead(int userID, NotificationType notificationType, long contextID)
	{
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			connection.ExecuteAsync("UPDATE pf_Notifications SET IsRead = 1 WHERE UserID = @userID AND NotificationType = @notificationType AND ContextID = @contextID", new { userID, notificationType, contextID }));
		RemoveCache(userID);
	}

	public async Task<List<Notification>> GetNotifications(int userID, int startRow, int pageSize)
	{
		var sql = @"DECLARE @Counter int
SET @Counter = (@startRow + @pageSize - 1)

SET ROWCOUNT @Counter;

WITH Entries AS ( 
SELECT ROW_NUMBER() OVER (ORDER BY [TimeStamp] DESC)
AS Row, UserID, NotificationType, ContextID, [TimeStamp], IsRead, [Data]
FROM pf_Notifications WHERE UserID = @userID )

SELECT UserID, NotificationType, ContextID, [TimeStamp], IsRead, [Data]
FROM Entries 
WHERE Row between 
@startRow and @startRow + @pageSize - 1

SET ROWCOUNT 0";
		Task<IEnumerable<Notification>> notifications = null;
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			notifications = connection.QueryAsync<Notification>(sql, new { userID, startRow, pageSize }));
		return notifications.Result.ToList();
	}

	public async Task<int> GetPageCount(int userID, int pageSize)
	{
		Task<double> count = null;
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			count = connection.QuerySingleAsync<double>("SELECT COUNT(*) FROM pf_Notifications WHERE UserID = @userID", new { userID }));
		var notificationCount = count.Result;
		if (notificationCount <= pageSize)
			return 1;
		var pageCount = Math.Ceiling(notificationCount / pageSize);
		return Convert.ToInt32(pageCount);
	}

	public async Task<int> GetUnreadNotificationCount(int userID)
	{
		var key = GetCacheKey(userID);
		var cachedItem = _cacheHelper.GetCacheObject<int?>(key);
		if (cachedItem != null)
			return 0;
		Task<int> count = null;
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			count = connection.QuerySingleAsync<int>("SELECT COUNT(*) FROM pf_Notifications WHERE UserID = @userID AND IsRead = 0", new { userID }));
		_cacheHelper.SetCacheObject(key, count.Result);
		return count.Result;
	}

	public async Task MarkAllRead(int userID)
	{
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			connection.ExecuteAsync("UPDATE pf_Notifications SET IsRead = 1 WHERE UserID = @userID", new { userID }));
		RemoveCache(userID);
	}

	public async Task<DateTime> GetOldestTime(int userID, int takeCount)
	{
		var notifications = await GetNotifications(userID, 1, takeCount);
		if (notifications.Count == 0)
			return new DateTime(1990, 1, 1);
		var last = notifications.Last();
		return last.TimeStamp;
	}

	public async Task DeleteOlderThan(int userID, DateTime timeCutOff)
	{
		await _sqlObjectFactory.GetConnection().UsingAsync(connection =>
			connection.ExecuteAsync("DELETE FROM pf_Notifications WHERE UserID = @UserID AND TimeStamp < @TimeStamp", new { UserID = userID, TimeStamp = timeCutOff }));
	}
}